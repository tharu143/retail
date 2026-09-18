import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
    Loader2, FileText, AlertCircle, CheckCircle2,
    Calendar, Filter, RefreshCw, Printer, ChevronDown,
    TrendingUp, DollarSign, Clock, User, Shield, CreditCard, ChevronRight,
    Receipt, Landmark, Smartphone, Tag, Gift, Check,
    ArrowRightLeft, Percent, Edit3, XCircle, RotateCcw, Eye, ExternalLink,
    ArrowUpRight, ArrowDownLeft, X, Wallet, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './DailySalesReport.css';

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
    const [data, setData] = useState({
        day_summary: {},
        openings: [],
        closings: [],
        invoices: [],
        high_discount_invoices: [],
        return_invoices: [],
        modified_invoices: [],
        receipts: [],
        payments: [],
        transfers: []
    });
    const [activeTab, setActiveTab] = useState('invoices'); // invoices, receipts_payments, transfers, discounts, modified, shifts
    const [searchTerm, setSearchTerm] = useState('');
    const [showThermalPreview, setShowThermalPreview] = useState(false);

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

    // Calculate aggregated metrics with fallback to day_summary from backend
    const summary = data.day_summary || {};
    const cashSale = summary.cash_sale !== undefined ? summary.cash_sale : 0;
    const cashSaleCount = summary.cash_sale_count || 0;
    const cardSale = summary.card_sale !== undefined ? summary.card_sale : 0;
    const cardSaleCount = summary.card_sale_count || 0;
    const onlinePayment = summary.online_payment !== undefined ? summary.online_payment : 0;
    const onlinePaymentCount = summary.online_payment_count || 0;
    const instaCash = summary.insta_cash !== undefined ? summary.insta_cash : (summary.instapay_sale || 0);
    const instaSale = instaCash;
    const instaCashCount = summary.insta_cash_count || 0;
    const receiptsTotal = summary.receipts !== undefined ? summary.receipts : 0;
    const receiptsCount = summary.receipts_count || (data.receipts?.length || 0);
    const salesReturn = summary.sales_return !== undefined ? summary.sales_return : 0;
    const salesReturnCount = summary.sales_return_count || (data.return_invoices?.length || 0);
    const paymentsTotal = summary.payments !== undefined ? summary.payments : 0;
    const paymentsCount = summary.payments_count || (data.payments?.length || 0);

    const totalCount = summary.total_count || (cashSaleCount + cardSaleCount + onlinePaymentCount + instaCashCount + receiptsCount + salesReturnCount + paymentsCount);
    const netTotal = summary.net_total !== undefined ? summary.net_total : (cashSale + cardSale + onlinePayment + instaCash - salesReturn + receiptsTotal - paymentsTotal);
    const cashBalance = summary.cash_balance !== undefined ? summary.cash_balance : (cashSale + instaCash + receiptsTotal - salesReturn - paymentsTotal);
    const advanceAmount = summary.advance_amount !== undefined ? summary.advance_amount : 0;
    const advanceCount = summary.advance_count || 0;

    const creditSale = summary.credit_sale !== undefined ? summary.credit_sale : 0;
    const creditSaleCount = summary.credit_sale_count || 0;
    const instaCredit = summary.insta_credit !== undefined ? summary.insta_credit : 0;
    const instaCreditCount = summary.insta_credit_count || 0;
    const branchTransfersAmount = summary.branch_transfers_amount !== undefined ? summary.branch_transfers_amount : 0;
    const branchTransfersCount = summary.branch_transfers_count || (data.transfers?.length || 0);
    const transfersCount = branchTransfersCount;

    const branchCollectionsAmount = summary.branch_collections_amount !== undefined ? summary.branch_collections_amount : 0;
    const branchCollectionsCount = summary.branch_collections_count || (data.branch_collections?.length || 0);

    const highDiscountAmount = summary.high_discount_amount !== undefined ? summary.high_discount_amount : 0;
    const highDiscountCount = summary.high_discount_count !== undefined ? summary.high_discount_count : (data.high_discount_invoices?.length || 0);
    const modifyBillsCount = summary.modify_bills_count !== undefined ? summary.modify_bills_count : (data.modified_invoices?.length || 0);
    const modifiedBillsCount = modifyBillsCount;
    const cancelBillsCount = summary.cancel_bills_count || (data.modified_invoices?.filter(m => m.status === 'Cancelled')?.length || 0);
    const counterCash = summary.counter_cash !== undefined ? summary.counter_cash : 0;
    const pettyCash = summary.petty_cash !== undefined ? summary.petty_cash : 0;
    const recharge = summary.recharge !== undefined ? summary.recharge : 0;

    const billsCount = summary.total_bills_count !== undefined ? summary.total_bills_count : (data.invoices?.filter(i => !i.is_return)?.length || 0);
    const returnBillsCount = summary.return_bills_count !== undefined ? summary.return_bills_count : (data.return_invoices?.length || 0);

    const shiftOpenTime = summary.shift_open_time ? new Date(summary.shift_open_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : (data.openings?.[0]?.period_start_date ? new Date(data.openings[0].period_start_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '9:10am');
    const shiftCloseTime = summary.shift_close_time ? new Date(summary.shift_close_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : (data.closings?.[0]?.period_end_date ? new Date(data.closings[0].period_end_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '10.00pm');
    const shiftStatus = summary.shift_status || (data.closings?.length > 0 ? 'Closed' : (data.openings?.length > 0 ? 'Active' : 'Active'));

    const dayName = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = selectedDate.split('-').reverse().join('/');

    // Print handlers
    const handlePrintA4 = () => {
        window.print();
    };

    const handlePrintThermal = () => {
        const thermalElement = document.getElementById('thermal-day-summary-slip');
        if (!thermalElement) return;

        const printWindow = window.open('', '_blank', 'width=380,height=650');
        if (!printWindow) {
            alert('Please allow popups to print thermal slip');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Day Summary - ${selectedDate}</title>
                <style>
                    @page {
                        margin: 0;
                        size: 80mm auto;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                        color: #000;
                        background: #fff;
                        padding: 10px 8px;
                        margin: 0;
                        line-height: 1.35;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .text-left { text-align: left; }
                    .font-bold { font-weight: bold; }
                    .font-black { font-weight: 900; }
                    .thermal-top-row {
                        display: flex;
                        justify-content: space-between;
                        font-weight: bold;
                        font-size: 13px;
                        margin-bottom: 2px;
                    }
                    .thermal-sub-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-size: 11px;
                        margin-bottom: 4px;
                    }
                    .thermal-dotted-sep {
                        border-top: 1px dotted #000;
                        margin: 5px 0;
                    }
                    .thermal-line-sep {
                        border-top: 1px solid #000;
                        margin: 5px 0;
                    }
                    .thermal-row-3col {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin: 3px 0;
                        font-size: 12px;
                    }
                    .col-title {
                        flex: 2;
                        text-align: left;
                    }
                    .col-qty {
                        flex: 0.8;
                        text-align: right;
                        padding-right: 14px;
                    }
                    .col-val {
                        flex: 1.2;
                        text-align: right;
                        font-weight: 600;
                    }
                    .total-highlight {
                        font-size: 13.5px;
                        font-weight: 900;
                    }
                </style>
            </head>
            <body>
                ${thermalElement.innerHTML}
                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Filter invoices by search term
    const filteredInvoices = (data.invoices || []).filter(inv => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (inv.name || '').toLowerCase().includes(term) ||
            (inv.customer_name || '').toLowerCase().includes(term) ||
            (inv.owner || '').toLowerCase().includes(term)
        );
    });

    return (
        <div className="dsr-container">
            {/* Top Bar / Header */}
            <header className="dsr-header no-print">
                <div className="dsr-header-title-box">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="dsr-icon-badge">
                                <BarChart3 size={20} className="stroke-[2.5]" />
                            </div>
                            <h1 className="dsr-title">DAILY SALES & SHIFT SUMMARY</h1>
                            <span className="dsr-live-tag">Live Audit</span>
                        </div>
                        <p className="dsr-subtitle">Daily sales, cash flows, discounts, inter-branch transfers & shift reconciliations</p>
                    </div>
                </div>

                <div className="dsr-actions">
                    <button
                        onClick={() => setShowThermalPreview(true)}
                        className="dsr-btn-thermal"
                        title="View & Print 80mm POS Thermal Slip"
                    >
                        <Receipt size={15} />
                        <span>Thermal Slip</span>
                    </button>
                    <button
                        onClick={handlePrintA4}
                        className="dsr-btn-print"
                        title="Print Full A4 Report"
                    >
                        <Printer size={15} />
                        <span>Print A4</span>
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

            {/* Print-Only A4 Header */}
            <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6 p-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Daily Shift & Sales Report</h1>
                        <p className="text-xs text-slate-600 mt-1">Full Audit Summary & Shift Reconciliation</p>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-700">
                        <div><b>Report Date:</b> {selectedDate}</div>
                        <div><b>Branch:</b> {isAdmin ? (selectedBranch || 'All Branches') : warehouse}</div>
                        <div><b>Shift Open:</b> {shiftOpenTime} | <b>Shift Close:</b> {shiftCloseTime}</div>
                    </div>
                </div>
            </div>

            <main className="dsr-main-body">
                {/* Independent Filter Controls */}
                <div className="dsr-filter-card no-print">
                    <div className="dsr-filter-inputs">
                        {/* Date Input */}
                        <div className="dsr-field-block">
                            <label className="dsr-label">
                                <Calendar size={12} color="#2563eb" />
                                Select Date
                            </label>
                            <input
                                ref={dateInputRef}
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="dsr-input"
                                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
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
                                    <Shield size={12} color="#2563eb" />
                                    Active Branch
                                </label>
                                <div className="dsr-active-branch-box">
                                    <Shield size={14} color="#2563eb" />
                                    <span>{warehouse || 'Branch User'}</span>
                                </div>
                            </div>
                        )}

                        {/* Shift Timing Badge */}
                        <div className="dsr-field-block" style={{ flex: '1.2 1 240px' }}>
                            <label className="dsr-label">
                                <Clock size={12} color="#0284c7" />
                                Shift Timings (Open / Close)
                            </label>
                            <div className="dsr-timing-badge-box">
                                <div className="dsr-timing-item">
                                    <span className="dsr-timing-label">OPEN</span>
                                    <span className="dsr-timing-val">{shiftOpenTime}</span>
                                </div>
                                <div className="dsr-timing-divider" />
                                <div className="dsr-timing-item">
                                    <span className="dsr-timing-label">CLOSE</span>
                                    <span className="dsr-timing-val">{shiftCloseTime}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={() => {
                            setSelectedDate(new Date().toISOString().split('T')[0]);
                            if (isAdmin) setSelectedBranch('');
                        }}
                        className="dsr-btn-reset"
                    >
                        Today
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="dsr-error-banner">
                        <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {/* 11 Primary KPI Metrics Grid */}
                <div className="dsr-kpi-grid">
                    {/* 1. Cash Sale */}
                    <div className="dsr-kpi-card green" onClick={() => setActiveTab('invoices')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <DollarSign size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">1. Cash Sale</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} />
                                <span>{cashSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#059669' }}>
                                Physical Cash In Register
                            </div>
                        </div>
                    </div>

                    {/* 2. Card Sale */}
                    <div className="dsr-kpi-card blue" onClick={() => setActiveTab('invoices')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <CreditCard size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">2. Card Sale</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} />
                                <span>{cardSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#2563eb' }}>
                                Debit / Credit Cards
                            </div>
                        </div>
                    </div>

                    {/* 3. Receipts */}
                    <div className="dsr-kpi-card teal" onClick={() => setActiveTab('receipts_payments')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <ArrowDownLeft size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">3. Receipts (+)</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} />
                                <span>{receiptsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#0d9488' }}>
                                {data.receipts?.length || 0} Collections Received
                            </div>
                        </div>
                    </div>

                    {/* 4. Payments */}
                    <div className="dsr-kpi-card red" onClick={() => setActiveTab('receipts_payments')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <ArrowUpRight size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">4. Payments (-)</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} />
                                <span>{paymentsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#e11d48' }}>
                                {data.payments?.length || 0} Expenses / Outflows
                            </div>
                        </div>
                    </div>

                    {/* 5. Insta Sale */}
                    <div className="dsr-kpi-card cyan" onClick={() => setActiveTab('invoices')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <Smartphone size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">5. Insta Sale</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} />
                                <span>{instaSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#0891b2' }}>
                                InstaPay Transfers
                            </div>
                        </div>
                    </div>

                    {/* 6. Credit Sale */}
                    <div className="dsr-kpi-card amber" onClick={() => setActiveTab('invoices')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <Clock size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">6. Credit Sale</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} />
                                <span>{creditSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#d97706' }}>
                                Outstanding Customer Credit
                            </div>
                        </div>
                    </div>

                    {/* 7. Inter-Branch Transfers */}
                    <div className="dsr-kpi-card indigo" onClick={() => setActiveTab('transfers')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <ArrowRightLeft size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">7. Branch Transfers</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value" style={{ fontSize: '1.25rem' }}>
                                <span>{transfersCount} Transfers</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#4f46e5' }}>
                                Material Stock Move
                            </div>
                        </div>
                    </div>

                    {/* 8. Shift Timing Card */}
                    <div className="dsr-kpi-card slate" onClick={() => setActiveTab('shifts')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <Clock size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">8. Shift Hours</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value" style={{ fontSize: '1rem', gap: '4px' }}>
                                <span style={{ color: '#059669' }}>{shiftOpenTime}</span>
                                <span style={{ color: '#94a3b8' }}>-</span>
                                <span style={{ color: '#2563eb' }}>{shiftCloseTime}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#64748b' }}>
                                {data.openings?.length || 0} Shift Openings
                            </div>
                        </div>
                    </div>

                    {/* 9. >10% Discounts */}
                    <div className="dsr-kpi-card pink" onClick={() => setActiveTab('discounts')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <Percent size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">9. &gt;10% Discounts</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value" style={{ fontSize: '1.25rem' }}>
                                <span>{highDiscountCount} Bills</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#db2777' }}>
                                High Discount Audits
                            </div>
                        </div>
                    </div>

                    {/* 10. Total Bills Count */}
                    <div className="dsr-kpi-card emerald" onClick={() => setActiveTab('invoices')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <FileText size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">10. Daily Bills Count</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value" style={{ fontSize: '1.25rem' }}>
                                <span>{billsCount} Bills</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#059669' }}>
                                {returnBillsCount} Returns • {summary.total_items_qty || 0} Items
                            </div>
                        </div>
                    </div>

                    {/* 11. Modify / Return Bills */}
                    <div className="dsr-kpi-card orange" onClick={() => setActiveTab('modified')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <Edit3 size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">11. Modify / Returns</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value" style={{ fontSize: '1.25rem' }}>
                                <span>{modifiedBillsCount} Invoices</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#ea580c' }}>
                                Returned / Amended Logs
                            </div>
                        </div>
                    </div>

                    {/* 12. Closing Collections */}
                    <div className="dsr-kpi-card emerald" onClick={() => setActiveTab('collections')}>
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <Wallet size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">12. Branch Collections</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value">
                                <DirhamIcon size={16} />
                                <span>{branchCollectionsAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#059669' }}>
                                {branchCollectionsCount} Collection(s) Received
                            </div>
                        </div>
                    </div>

                    {/* Net Grand Total Card */}
                    <div className="dsr-kpi-card net-total-card">
                        <div className="dsr-kpi-header">
                            <div className="dsr-kpi-header-left">
                                <div className="dsr-kpi-icon-pill">
                                    <div className="dsr-kpi-icon-inner">
                                        <Receipt size={14} />
                                    </div>
                                </div>
                                <span className="dsr-kpi-title">Day Net Total</span>
                            </div>
                            <ChevronRight size={14} className="dsr-kpi-arrow" />
                        </div>
                        <div>
                            <div className="dsr-kpi-value net-value">
                                <DirhamIcon size={18} />
                                <span>{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="dsr-kpi-subtext" style={{ color: '#047857', fontWeight: 800 }}>
                                Final Reconciled Day Balance
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="dsr-tab-nav no-print">
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`dsr-tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
                    >
                        <FileText size={15} />
                        <span>Sales Invoices ({billsCount})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('receipts_payments')}
                        className={`dsr-tab-btn ${activeTab === 'receipts_payments' ? 'active' : ''}`}
                    >
                        <Landmark size={15} />
                        <span>Receipts & Payments ({(data.receipts?.length || 0) + (data.payments?.length || 0)})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('transfers')}
                        className={`dsr-tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
                    >
                        <ArrowRightLeft size={15} />
                        <span>Branch Transfers ({transfersCount})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('discounts')}
                        className={`dsr-tab-btn ${activeTab === 'discounts' ? 'active' : ''}`}
                    >
                        <Percent size={15} />
                        <span>&gt;10% Discounts ({highDiscountCount})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('modified')}
                        className={`dsr-tab-btn ${activeTab === 'modified' ? 'active' : ''}`}
                    >
                        <Edit3 size={15} />
                        <span>Modify / Returns ({modifiedBillsCount})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('shifts')}
                        className={`dsr-tab-btn ${activeTab === 'shifts' ? 'active' : ''}`}
                    >
                        <Clock size={15} />
                        <span>Shifts & Cash Float ({(data.openings?.length || 0) + (data.closings?.length || 0)})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('collections')}
                        className={`dsr-tab-btn ${activeTab === 'collections' ? 'active' : ''}`}
                    >
                        <Wallet size={15} />
                        <span>Closing Collections ({branchCollectionsCount})</span>
                    </button>
                </div>

                {/* Content Views */}
                {loading ? (
                    <div className="dsr-loading-box">
                        <Loader2 size={36} color="#10b981" className="animate-spin" />
                        <span className="dsr-loading-text">Loading daily transactions data...</span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* ==================== TAB 1: SALES INVOICES ==================== */}
                        {activeTab === 'invoices' && (
                            <div className="dsr-section-card">
                                <div className="dsr-section-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h3 className="dsr-section-heading">
                                            <FileText size={18} color="#10b981" />
                                            <span>Sales Invoices Breakdown</span>
                                        </h3>
                                        <span className="dsr-badge-count">{filteredInvoices.length} Bills</span>
                                    </div>
                                    <div className="no-print" style={{ minWidth: '220px' }}>
                                        <input
                                            type="text"
                                            placeholder="Search invoice, customer, cashier..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="dsr-search-input"
                                        />
                                    </div>
                                </div>

                                {filteredInvoices.length === 0 ? (
                                    <div className="dsr-empty-box">
                                        No sales invoices found for this date.
                                    </div>
                                ) : (
                                    <div className="dsr-table-wrapper">
                                        <table className="dsr-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                                    <th>Invoice ID</th>
                                                    <th>Customer</th>
                                                    <th>Cashier</th>
                                                    <th>Time</th>
                                                    <th>Items / Qty</th>
                                                    <th>Payment Breakdown</th>
                                                    <th style={{ textAlign: 'right' }}>Grand Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredInvoices.map((inv, idx) => (
                                                    <tr key={inv.name} className={inv.is_return ? 'dsr-return-row' : ''}>
                                                        <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 800 }}>{idx + 1}</td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span
                                                                    onClick={() => navigate('/salesinvoicelist', { state: { search: inv.name } })}
                                                                    className="dsr-doc-link"
                                                                >
                                                                    {inv.name}
                                                                    <ExternalLink size={11} color="#10b981" />
                                                                </span>
                                                                {inv.is_return && <span className="dsr-tag-return">RETURN</span>}
                                                                {inv.is_high_discount && <span className="dsr-tag-discount">{inv.discount_percentage}% OFF</span>}
                                                            </div>
                                                        </td>
                                                        <td style={{ fontWeight: 800, color: '#1e293b' }}>{inv.customer_name || 'Walk-in Customer'}</td>
                                                        <td style={{ color: '#475569' }}>{inv.owner?.split('@')[0]}</td>
                                                        <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{inv.posting_time}</td>
                                                        <td style={{ color: '#334155', fontWeight: 700 }}>
                                                            {inv.total_qty || 0} pcs <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({inv.item_count || 0} items)</span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                                {inv.payments?.map((p, pIdx) => (
                                                                    <span key={pIdx} className={`dsr-pay-pill ${p.mode_of_payment?.toLowerCase()}`}>
                                                                        {p.mode_of_payment}: <b>{p.amount.toFixed(2)}</b>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900, color: inv.is_return ? '#e11d48' : '#0f172a' }}>
                                                            AED {inv.grand_total.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr>
                                                    <td style={{ textAlign: 'center' }}>TOTAL</td>
                                                    <td colSpan={5} style={{ color: '#64748b' }}>
                                                        {billsCount} Sales Bills ({returnBillsCount} Returns)
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            {cashSale > 0 && <span className="dsr-pay-pill cash font-black">Cash: {cashSale.toFixed(2)}</span>}
                                                            {cardSale > 0 && <span className="dsr-pay-pill card font-black">Card: {cardSale.toFixed(2)}</span>}
                                                            {instaSale > 0 && <span className="dsr-pay-pill insta font-black">Insta: {instaSale.toFixed(2)}</span>}
                                                            {creditSale > 0 && <span className="dsr-pay-pill credit font-black">Credit: {creditSale.toFixed(2)}</span>}
                                                            {salesReturn > 0 && <span className="dsr-pay-pill return font-black">Return: -{salesReturn.toFixed(2)}</span>}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#059669', fontSize: '1rem' }}>
                                                        AED {netTotal.toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==================== TAB 2: RECEIPTS & PAYMENTS ==================== */}
                        {activeTab === 'receipts_payments' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                                {/* Receipts (Collections) */}
                                <div className="dsr-section-card">
                                    <div className="dsr-section-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ArrowDownLeft size={18} color="#0d9488" />
                                            <h3 className="dsr-section-heading">Customer Receipts / Cash In</h3>
                                        </div>
                                        <span className="dsr-badge-count green">AED {receiptsTotal.toFixed(2)}</span>
                                    </div>

                                    {data.receipts?.length === 0 ? (
                                        <div className="dsr-empty-box">No customer receipts recorded for this date.</div>
                                    ) : (
                                        <div className="dsr-table-wrapper">
                                            <table className="dsr-table">
                                                <thead>
                                                    <tr>
                                                        <th>Receipt #</th>
                                                        <th>Customer / Party</th>
                                                        <th>Mode</th>
                                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.receipts?.map(rc => (
                                                        <tr key={rc.name}>
                                                            <td><b style={{ color: '#0d9488' }}>{rc.name}</b></td>
                                                            <td>
                                                                <div><b>{rc.party_name}</b></div>
                                                                {rc.remarks && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{rc.remarks}</span>}
                                                            </td>
                                                            <td><span className="dsr-pay-pill">{rc.mode_of_payment}</span></td>
                                                            <td style={{ textAlign: 'right', fontWeight: 900, color: '#0d9488' }}>+AED {rc.amount.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Payments (Expenses / Payouts) */}
                                <div className="dsr-section-card">
                                    <div className="dsr-section-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ArrowUpRight size={18} color="#e11d48" />
                                            <h3 className="dsr-section-heading">Supplier Payments & Expenses / Cash Out</h3>
                                        </div>
                                        <span className="dsr-badge-count red">-AED {paymentsTotal.toFixed(2)}</span>
                                    </div>

                                    {data.payments?.length === 0 ? (
                                        <div className="dsr-empty-box">No expense or supplier payments recorded for this date.</div>
                                    ) : (
                                        <div className="dsr-table-wrapper">
                                            <table className="dsr-table">
                                                <thead>
                                                    <tr>
                                                        <th>Payment #</th>
                                                        <th>Supplier / Party</th>
                                                        <th>Mode</th>
                                                        <th style={{ textAlign: 'right' }}>Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.payments?.map(pm => (
                                                        <tr key={pm.name}>
                                                            <td><b style={{ color: '#e11d48' }}>{pm.name}</b></td>
                                                            <td>
                                                                <div><b>{pm.party_name}</b></div>
                                                                {pm.remarks && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{pm.remarks}</span>}
                                                            </td>
                                                            <td><span className="dsr-pay-pill">{pm.mode_of_payment}</span></td>
                                                            <td style={{ textAlign: 'right', fontWeight: 900, color: '#e11d48' }}>-AED {pm.amount.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ==================== TAB 3: INTER-BRANCH TRANSFERS ==================== */}
                        {activeTab === 'transfers' && (
                            <div className="dsr-section-card">
                                <div className="dsr-section-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ArrowRightLeft size={18} color="#4f46e5" />
                                        <h3 className="dsr-section-heading">Inter-Branch Stock Transfers</h3>
                                    </div>
                                    <span className="dsr-badge-count">{transfersCount} Transfers</span>
                                </div>

                                {data.transfers?.length === 0 ? (
                                    <div className="dsr-empty-box">No inter-branch transfers recorded for this date.</div>
                                ) : (
                                    <div className="dsr-table-wrapper">
                                        <table className="dsr-table">
                                            <thead>
                                                <tr>
                                                    <th>Transfer ID</th>
                                                    <th>Time</th>
                                                    <th>Source (From)</th>
                                                    <th>Destination (To)</th>
                                                    <th>Total Qty</th>
                                                    <th>Items Breakdown</th>
                                                    <th style={{ textAlign: 'right' }}>Valuation Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.transfers?.map(tr => (
                                                    <tr key={tr.name}>
                                                        <td><b style={{ color: '#4f46e5' }}>{tr.name}</b></td>
                                                        <td style={{ fontFamily: 'monospace' }}>{tr.posting_time}</td>
                                                        <td><span className="dsr-wh-pill from">{tr.from_warehouse}</span></td>
                                                        <td><span className="dsr-wh-pill to">{tr.to_warehouse}</span></td>
                                                        <td style={{ fontWeight: 800 }}>{tr.total_qty} units</td>
                                                        <td>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                                {tr.items?.map((it, itIdx) => (
                                                                    <span key={itIdx} className="dsr-item-pill">
                                                                        {it.item_name || it.item_code} (x{it.qty})
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                                                            AED {tr.total_amount.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==================== TAB 4: >10% DISCOUNTS AUDIT ==================== */}
                        {activeTab === 'discounts' && (
                            <div className="dsr-section-card">
                                <div className="dsr-section-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Percent size={18} color="#db2777" />
                                        <h3 className="dsr-section-heading">&gt; 10% High Discount Bills Audit</h3>
                                    </div>
                                    <span className="dsr-badge-count red">{highDiscountCount} High Discount Bills</span>
                                </div>

                                {data.high_discount_invoices?.length === 0 ? (
                                    <div className="dsr-empty-box">No invoices with &gt; 10% discount recorded on this date.</div>
                                ) : (
                                    <div className="dsr-table-wrapper">
                                        <table className="dsr-table">
                                            <thead>
                                                <tr>
                                                    <th>Invoice ID</th>
                                                    <th>Customer</th>
                                                    <th>Cashier</th>
                                                    <th>Time</th>
                                                    <th style={{ textAlign: 'center' }}>Discount %</th>
                                                    <th style={{ textAlign: 'right' }}>Discount Amount</th>
                                                    <th style={{ textAlign: 'right' }}>Grand Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.high_discount_invoices?.map(inv => (
                                                    <tr key={inv.name}>
                                                        <td>
                                                            <span
                                                                onClick={() => navigate('/salesinvoicelist', { state: { search: inv.name } })}
                                                                className="dsr-doc-link"
                                                            >
                                                                {inv.name}
                                                                <ExternalLink size={11} color="#db2777" />
                                                            </span>
                                                        </td>
                                                        <td style={{ fontWeight: 800 }}>{inv.customer_name}</td>
                                                        <td style={{ color: '#475569' }}>{inv.owner?.split('@')[0]}</td>
                                                        <td style={{ fontFamily: 'monospace' }}>{inv.posting_time}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <span className="dsr-high-discount-badge">
                                                                {inv.discount_percentage}% OFF
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#db2777' }}>
                                                            -AED {inv.discount_amount.toFixed(2)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                                                            AED {inv.grand_total.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==================== TAB 5: MODIFIED & RETURN BILLS ==================== */}
                        {activeTab === 'modified' && (
                            <div className="dsr-section-card">
                                <div className="dsr-section-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Edit3 size={18} color="#ea580c" />
                                        <h3 className="dsr-section-heading">Modified, Return & Cancelled Bills</h3>
                                    </div>
                                    <span className="dsr-badge-count">{modifiedBillsCount} Entries</span>
                                </div>

                                {data.modified_invoices?.length === 0 ? (
                                    <div className="dsr-empty-box">No modified, cancelled, or return bills recorded on this date.</div>
                                ) : (
                                    <div className="dsr-table-wrapper">
                                        <table className="dsr-table">
                                            <thead>
                                                <tr>
                                                    <th>Invoice ID</th>
                                                    <th>Type / Status</th>
                                                    <th>Customer</th>
                                                    <th>Cashier</th>
                                                    <th>Original Reference</th>
                                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.modified_invoices?.map((inv, idx) => (
                                                    <tr key={idx}>
                                                        <td><b style={{ color: '#ea580c' }}>{inv.name}</b></td>
                                                        <td>
                                                            {inv.is_return ? (
                                                                <span className="dsr-tag-return">RETURN BILL</span>
                                                            ) : inv.status === 'Cancelled' ? (
                                                                <span className="dsr-tag-cancelled">CANCELLED</span>
                                                            ) : (
                                                                <span className="dsr-tag-amended">AMENDED</span>
                                                            )}
                                                        </td>
                                                        <td style={{ fontWeight: 800 }}>{inv.customer_name}</td>
                                                        <td style={{ color: '#475569' }}>{inv.owner?.split('@')[0]}</td>
                                                        <td>
                                                            {inv.return_against ? (
                                                                <span style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '0.75rem' }}>Against: {inv.return_against}</span>
                                                            ) : inv.amended_from ? (
                                                                <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>Amended From: {inv.amended_from}</span>
                                                            ) : '-'}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 900, color: inv.is_return ? '#e11d48' : '#0f172a' }}>
                                                            AED {Math.abs(inv.grand_total || 0).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==================== TAB 6: SHIFT FLOATS & RECONCILIATIONS ==================== */}
                        {activeTab === 'shifts' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Shifts Opened */}
                                <div className="dsr-section-card">
                                    <div className="dsr-section-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Clock size={18} color="#10b981" />
                                            <h3 className="dsr-section-heading">Register Shifts Opened & Starting Cash Float</h3>
                                        </div>
                                        <span className="dsr-badge-count">{data.openings?.length || 0} Shifts</span>
                                    </div>

                                    {data.openings?.length === 0 ? (
                                        <div className="dsr-empty-box">No register openings recorded on this date.</div>
                                    ) : (
                                        <div>
                                            {data.openings?.map(op => (
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
                                                        <div className="dsr-meta-group">
                                                            <div className="dsr-meta-pill">
                                                                <span className="dsr-meta-icon-badge" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                                                    <User size={13} />
                                                                </span>
                                                                <span className="dsr-meta-label">Cashier:</span>
                                                                <span className="dsr-meta-value">{op.user?.split('@')[0]}</span>
                                                            </div>
                                                            <div className="dsr-meta-pill">
                                                                <span className="dsr-meta-icon-badge" style={{ background: '#eff6ff', color: '#2563eb' }}>
                                                                    <Clock size={13} />
                                                                </span>
                                                                <span className="dsr-meta-label">Opened:</span>
                                                                <span className="dsr-meta-value">{new Date(op.period_start_date).toLocaleTimeString()}</span>
                                                            </div>
                                                            <div className="dsr-meta-pill">
                                                                <span className="dsr-meta-icon-badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                                                                    <CreditCard size={13} />
                                                                </span>
                                                                <span className="dsr-meta-label">Profile:</span>
                                                                <span className="dsr-meta-value">{op.pos_profile}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                                        <div>
                                                            <span className="dsr-sub-heading">Starting Floats</span>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {op.balances?.map((bal, idx) => (
                                                                    <div key={idx} className="dsr-bal-row">
                                                                        <span>{bal.mode_of_payment}</span>
                                                                        <b>AED {bal.opening_amount.toFixed(2)}</b>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="dsr-sub-heading">Opening Denominations</span>
                                                            <div className="dsr-denom-grid">
                                                                {op.denominations?.map((den, idx) => (
                                                                    <div key={idx} className="dsr-denom-box">
                                                                        <span className="dsr-denom-label">{den.denomination} AED</span>
                                                                        <div className="dsr-denom-count">{den.count} qty</div>
                                                                        <span className="dsr-denom-total">AED {den.amount.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Shifts Closed */}
                                <div className="dsr-section-card">
                                    <div className="dsr-section-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CheckCircle2 size={18} color="#10b981" />
                                            <h3 className="dsr-section-heading">Register Shifts Closed & Reconciliations</h3>
                                        </div>
                                        <span className="dsr-badge-count">{data.closings?.length || 0} Closings</span>
                                    </div>

                                    {data.closings?.length === 0 ? (
                                        <div className="dsr-empty-box">No register closings recorded on this date.</div>
                                    ) : (
                                        <div>
                                            {data.closings?.map(cl => (
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
                                                            <span className="dsr-status-badge closed">CLOSED</span>
                                                        </div>
                                                        <div className="dsr-meta-group">
                                                            <div className="dsr-meta-pill">
                                                                <span className="dsr-meta-icon-badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                                                    <User size={13} />
                                                                </span>
                                                                <span className="dsr-meta-label">Closed By:</span>
                                                                <span className="dsr-meta-value">{cl.user?.split('@')[0]}</span>
                                                            </div>
                                                            <div className="dsr-meta-pill">
                                                                <span className="dsr-meta-icon-badge" style={{ background: '#fff7ed', color: '#ea580c' }}>
                                                                    <Clock size={13} />
                                                                </span>
                                                                <span className="dsr-meta-label">Closed At:</span>
                                                                <span className="dsr-meta-value">{new Date(cl.period_end_date).toLocaleTimeString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>

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
                                                                        <td><b>{r.mode_of_payment}</b></td>
                                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(r.opening_amount || 0).toFixed(2)}</td>
                                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(r.expected_amount || 0).toFixed(2)}</td>
                                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 900 }}>{(r.closing_amount || 0).toFixed(2)}</td>
                                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: r.difference > 0 ? '#e11d48' : r.difference < 0 ? '#059669' : '#64748b' }}>
                                                                            {r.difference !== 0 ? (r.difference > 0 ? `-${r.difference.toFixed(2)}` : `+${Math.abs(r.difference).toFixed(2)}`) : '0.00'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 7: BRANCH CLOSING COLLECTIONS */}
                        {activeTab === 'collections' && (
                            <div className="dsr-section-card">
                                <div className="dsr-section-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Wallet size={18} color="#059669" />
                                        <h3 className="dsr-section-heading">Branch Closing Collections</h3>
                                    </div>
                                    <span className="dsr-badge-count">{data.branch_collections?.length || 0} Records</span>
                                </div>

                                {(!data.branch_collections || data.branch_collections.length === 0) ? (
                                    <div className="dsr-empty-box">No closing collections recorded for this branch on this date.</div>
                                ) : (
                                    <div className="dsr-table-wrapper">
                                        <table className="dsr-table">
                                            <thead>
                                                <tr>
                                                    <th>Doc No</th>
                                                    <th>Time</th>
                                                    <th>Collector</th>
                                                    <th>Secret Code</th>
                                                    <th>Mode / Banking</th>
                                                    <th style={{ textAlign: 'right' }}>Collected Amount</th>
                                                    <th style={{ textAlign: 'right' }}>Remaining Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.branch_collections.map((col, cIdx) => (
                                                    <tr key={col.name || cIdx}>
                                                        <td>
                                                            <span className="font-bold text-slate-800">{col.name}</span>
                                                        </td>
                                                        <td>{col.posting_time || '-'}</td>
                                                        <td>
                                                            <b>{col.collector_name || col.employee || '-'}</b>
                                                        </td>
                                                        <td>
                                                            <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                                {col.secret_code || '-'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {col.collection_type === 'Bank Transfer' ? (
                                                                <span style={{ color: '#0284c7', fontWeight: 700 }}>
                                                                    Bank: {col.banking_reference || col.bank_account || 'Transfer'}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: '#059669', fontWeight: 700 }}>Cash</span>
                                                            )}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: '#059669' }}>
                                                            AED {parseFloat(col.amount || 0).toFixed(2)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#475569' }}>
                                                            AED {parseFloat(col.remaining_balance || 0).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                )}
            </main>

            {/* ==================== THERMAL DAY SUMMARY PREVIEW MODAL ==================== */}
            {showThermalPreview && (
                <div className="dsr-modal-backdrop" onClick={() => setShowThermalPreview(false)}>
                    <div className="dsr-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="dsr-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Receipt size={20} color="#059669" />
                                <h3>POS Thermal Day Summary</h3>
                            </div>
                            <button onClick={() => setShowThermalPreview(false)} className="dsr-btn-icon">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="dsr-modal-body">
                            {/* Thermal Paper Slip UI Replicating User's Spreadsheet Reference */}
                            <div className="dsr-thermal-slip" id="thermal-day-summary-slip">
                                <div className="thermal-top-row">
                                    <span className="font-bold">{dayName}</span>
                                    <span className="font-bold">{formattedDate}</span>
                                </div>
                                <div className="thermal-sub-row">
                                    <span>{shiftOpenTime}</span>
                                    <span className="font-bold">{shiftStatus}</span>
                                    <span>{shiftCloseTime}</span>
                                </div>

                                <div className="thermal-dotted-sep">................................................</div>

                                <div className="thermal-table-body">
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Cash Sale</span>
                                        <span className="col-qty">{cashSaleCount || 0}</span>
                                        <span className="col-val">{cashSale ? (cashSale % 1 === 0 ? cashSale.toFixed(0) : cashSale.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Card Sale</span>
                                        <span className="col-qty">{cardSaleCount || 0}</span>
                                        <span className="col-val">{cardSale ? (cardSale % 1 === 0 ? cardSale.toFixed(0) : cardSale.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">online payment</span>
                                        <span className="col-qty">{onlinePaymentCount || 0}</span>
                                        <span className="col-val">{onlinePayment ? (onlinePayment % 1 === 0 ? onlinePayment.toFixed(0) : onlinePayment.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Ins. Cash</span>
                                        <span className="col-qty">{instaCashCount || 0}</span>
                                        <span className="col-val">{instaCash ? (instaCash % 1 === 0 ? instaCash.toFixed(0) : instaCash.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Receipts</span>
                                        <span className="col-qty">{receiptsCount || 0}</span>
                                        <span className="col-val">{receiptsTotal ? (receiptsTotal % 1 === 0 ? receiptsTotal.toFixed(0) : receiptsTotal.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Sales Return</span>
                                        <span className="col-qty">{salesReturnCount || 0}</span>
                                        <span className="col-val">{salesReturn > 0 ? `-${salesReturn % 1 === 0 ? salesReturn.toFixed(0) : salesReturn.toFixed(2)}` : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Payments</span>
                                        <span className="col-qty">{paymentsCount || 0}</span>
                                        <span className="col-val">{paymentsTotal > 0 ? `-${paymentsTotal % 1 === 0 ? paymentsTotal.toFixed(0) : paymentsTotal.toFixed(2)}` : '0'}</span>
                                    </div>

                                    <div className="thermal-line-sep">------------------------------------------------</div>

                                    <div className="thermal-row-3col total-highlight">
                                        <span className="col-title font-black">Total</span>
                                        <span className="col-qty font-black">{totalCount || 0}</span>
                                        <span className="col-val font-black">{netTotal ? (netTotal % 1 === 0 ? netTotal.toFixed(0) : netTotal.toFixed(2)) : '0'}</span>
                                    </div>

                                    <div className="thermal-line-sep">------------------------------------------------</div>

                                    <div className="thermal-row-3col">
                                        <span className="col-title">cash balance</span>
                                        <span className="col-qty"></span>
                                        <span className="col-val">{cashBalance ? (cashBalance % 1 === 0 ? cashBalance.toFixed(0) : cashBalance.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Advance Amount</span>
                                        <span className="col-qty">{advanceCount || 0}</span>
                                        <span className="col-val">{advanceAmount ? (advanceAmount % 1 === 0 ? advanceAmount.toFixed(0) : advanceAmount.toFixed(2)) : '0'}</span>
                                    </div>

                                    <div className="thermal-dotted-sep">................................................</div>

                                    <div className="thermal-row-3col">
                                        <span className="col-title">Credit</span>
                                        <span className="col-qty">{creditSaleCount || 0}</span>
                                        <span className="col-val">{creditSale ? (creditSale % 1 === 0 ? creditSale.toFixed(0) : creditSale.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Ins. Credit</span>
                                        <span className="col-qty">{instaCreditCount || 0}</span>
                                        <span className="col-val">{instaCredit ? (instaCredit % 1 === 0 ? instaCredit.toFixed(0) : instaCredit.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">branch transfers</span>
                                        <span className="col-qty">{branchTransfersCount || 0}</span>
                                        <span className="col-val">{branchTransfersAmount ? (branchTransfersAmount % 1 === 0 ? branchTransfersAmount.toFixed(0) : branchTransfersAmount.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">branch collections</span>
                                        <span className="col-qty">{branchCollectionsCount || 0}</span>
                                        <span className="col-val">{branchCollectionsAmount ? (branchCollectionsAmount % 1 === 0 ? branchCollectionsAmount.toFixed(0) : branchCollectionsAmount.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">10% Above Discount</span>
                                        <span className="col-qty">{highDiscountCount || 0}</span>
                                        <span className="col-val">{highDiscountAmount ? (highDiscountAmount % 1 === 0 ? highDiscountAmount.toFixed(0) : highDiscountAmount.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Modify Bills</span>
                                        <span className="col-qty">{modifyBillsCount || 0}</span>
                                        <span className="col-val"></span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">Cancel Bills</span>
                                        <span className="col-qty">{cancelBillsCount || 0}</span>
                                        <span className="col-val"></span>
                                    </div>

                                    <div className="thermal-dotted-sep">................................................</div>

                                    <div className="thermal-row-3col">
                                        <span className="col-title">counter cash</span>
                                        <span className="col-qty"></span>
                                        <span className="col-val">{counterCash ? (counterCash % 1 === 0 ? counterCash.toFixed(0) : counterCash.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">petty cash</span>
                                        <span className="col-qty"></span>
                                        <span className="col-val">{pettyCash ? (pettyCash % 1 === 0 ? pettyCash.toFixed(0) : pettyCash.toFixed(2)) : '0'}</span>
                                    </div>
                                    <div className="thermal-row-3col">
                                        <span className="col-title">recharg</span>
                                        <span className="col-qty"></span>
                                        <span className="col-val">{recharge ? (recharge % 1 === 0 ? recharge.toFixed(0) : recharge.toFixed(2)) : '0'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="dsr-modal-footer">
                            <button
                                onClick={handlePrintThermal}
                                className="dsr-btn-print-modal"
                            >
                                <Printer size={16} />
                                <span>Print Thermal Slip (80mm)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DailySalesReport;
