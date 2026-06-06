import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Filter, RefreshCw, Printer, ChevronDown, 
    TrendingUp, DollarSign, Clock, User, Shield, CreditCard, ChevronRight, HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

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
    
    const totalCashCollected = data.invoices?.reduce((sum, inv) => {
        const cashPay = inv.payments?.find(p => p.mode_of_payment === 'Cash');
        return sum + (cashPay ? cashPay.amount : 0);
    }, 0) || 0;

    const totalOtherCollected = totalRevenue - totalCashCollected;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="so-page p-6 max-w-7xl mx-auto space-y-6">
            
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5 no-print">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                        <FileText className="w-7 h-7 text-indigo-600" />
                        Daily Shift & Sales Report
                    </h1>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                        Shift float opening counts, daily sales payments, and closing reconciliations
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlePrint}
                        className="px-4 py-2 border-2 border-slate-200/80 rounded-xl hover:bg-slate-50 transition-all font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-2 bg-white"
                    >
                        <Printer className="w-4 h-4" /> Print Report
                    </button>
                    <button 
                        onClick={fetchDailyReport}
                        className="px-4 py-2 border-2 border-slate-200/80 rounded-xl hover:bg-slate-50 transition-all font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-2 bg-white"
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
            </div>

            {/* Print Only Header */}
            <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Daily Shift & Sales Report</h1>
                <div className="mt-2 grid grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                    <div>Date: {selectedDate}</div>
                    <div>Branch: {isAdmin ? (selectedBranch || 'All Branches') : warehouse}</div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-5 items-end no-print">
                {/* Date Input - Clicking anywhere on this input block opens the datepicker */}
                <div 
                    className="space-y-1.5 cursor-pointer"
                    onClick={() => {
                        try {
                            if (dateInputRef.current) {
                                dateInputRef.current.showPicker();
                            }
                        } catch (err) {}
                    }}
                >
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        Select Date
                    </label>
                    <div className="relative">
                        <input 
                            ref={dateInputRef}
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-bold text-slate-800 bg-white cursor-pointer"
                        />
                    </div>
                </div>

                {/* Branch Selection */}
                {isAdmin ? (
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <Filter className="w-3.5 h-3.5 text-indigo-500" />
                            Branch / Warehouse
                        </label>
                        <div className="relative">
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-bold text-slate-800 bg-white"
                            >
                                <option value="">All Branches</option>
                                {warehouses.map(w => (
                                    <option key={w.value} value={w.value}>{w.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <Shield className="w-3.5 h-3.5 text-indigo-500" />
                            Branch
                        </label>
                        <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm">
                            {warehouse || 'Branch User'}
                        </div>
                    </div>
                )}

                {/* Reset Button */}
                <button
                    onClick={() => {
                        setSelectedDate(new Date().toISOString().split('T')[0]);
                        if (isAdmin) setSelectedBranch('');
                    }}
                    className="w-full py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                    Reset to Today
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-semibold shadow-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <span>{error}</span>
                </div>
            )}

            {/* Metrics cards bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between border-l-4 border-l-indigo-600">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">POS Sales Volume</span>
                    <span className="text-2xl font-black text-slate-800 mt-2 flex items-center gap-1.5">
                        <DirhamIcon size={16} /> {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Across {totalInvoicesCount} transactions
                    </span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cash Payments Collected</span>
                    <span className="text-2xl font-black text-emerald-600 mt-2 flex items-center gap-1.5">
                        <DirhamIcon size={16} /> {totalCashCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Physical Cash Drawer
                    </span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between border-l-4 border-l-blue-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Non-Cash (Card/Other)</span>
                    <span className="text-2xl font-black text-blue-600 mt-2 flex items-center gap-1.5">
                        <DirhamIcon size={16} /> {totalOtherCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Bank / Card Terminal Sales
                    </span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between border-l-4 border-l-amber-500">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Register Sessions</span>
                    <span className="text-2xl font-black text-amber-600 mt-2">
                        {data.openings?.length || 0}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Opened Register Cashiers
                    </span>
                </div>
            </div>

            {/* TAB PANEL SELECTION BUTTONS */}
            <div className="flex border-b border-slate-200 gap-2 no-print">
                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`px-5 py-3 font-black uppercase tracking-wider text-xs border-b-2 transition-all flex items-center gap-2 ${activeTab === 'invoices' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <FileText className="w-4 h-4" /> Sales Invoices ({data.invoices?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('openings')}
                    className={`px-5 py-3 font-black uppercase tracking-wider text-xs border-b-2 transition-all flex items-center gap-2 ${activeTab === 'openings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <Clock className="w-4 h-4" /> Shifts Opened ({data.openings?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('closings')}
                    className={`px-5 py-3 font-black uppercase tracking-wider text-xs border-b-2 transition-all flex items-center gap-2 ${activeTab === 'closings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    <CheckCircle2 className="w-4 h-4" /> Shifts Closed ({data.closings?.length || 0})
                </button>
            </div>

            {/* CONTENT VIEWS */}
            {loading ? (
                <div className="py-24 text-center space-y-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Loading daily transactions data...</span>
                </div>
            ) : (
                <div className="space-y-8">

                    {/* Section 1: Sales Invoices (Prints always, but active dynamically on tab in UI) */}
                    <div className={`${activeTab === 'invoices' ? 'block' : 'hidden print:block'} bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm`}>
                        <h3 className="text-base font-black text-slate-800 mb-4 uppercase tracking-tight flex items-center gap-2 border-b border-slate-100 pb-3">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            Sales Invoices List
                        </h3>

                        {data.invoices?.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 font-semibold text-sm">
                                No sales invoices submitted on this date.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                                            <th className="py-3 px-4">Invoice ID</th>
                                            <th className="py-3 px-4">Customer</th>
                                            <th className="py-3 px-4">Cashier</th>
                                            <th className="py-3 px-4">Time</th>
                                            <th className="py-3 px-4">Payment Breakdown</th>
                                            <th className="py-3 px-4 text-right">Grand Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.invoices?.map((inv) => (
                                            <tr key={inv.name} className="hover:bg-slate-50/40 text-slate-700">
                                                <td className="py-3 px-4 font-bold text-slate-900">{inv.name}</td>
                                                <td className="py-3 px-4 font-semibold">{inv.customer_name}</td>
                                                <td className="py-3 px-4">{inv.owner?.split('@')[0]}</td>
                                                <td className="py-3 px-4 text-slate-500">{inv.posting_time}</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {inv.payments?.map((p, pIdx) => (
                                                            <span key={pIdx} className="bg-slate-50 border border-slate-200/60 rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                                                {p.mode_of_payment}: {p.amount.toFixed(2)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-slate-900">
                                                    AED {inv.grand_total.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Section 2: Shifts Opened (Prints always, but active dynamically on tab in UI) */}
                    <div className={`${activeTab === 'openings' ? 'block' : 'hidden print:block'} bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6`}>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 border-b border-slate-100 pb-3">
                            <Clock className="w-5 h-5 text-indigo-500" />
                            Register Shifts Opened
                        </h3>

                        {data.openings?.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 font-semibold text-sm">
                                No shifts opened on this date.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {data.openings?.map((op) => (
                                    <div key={op.name} className="border border-slate-100 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-slate-900">{op.name}</span>
                                                <span className="bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                    {op.status}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
                                                <div className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /> Cashier: <b>{op.user?.split('@')[0]}</b></div>
                                                <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> Opened at: <b>{new Date(op.period_start_date).toLocaleTimeString()}</b></div>
                                                <div className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-slate-400" /> Profile: <b>{op.pos_profile}</b></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Balances details */}
                                            <div className="lg:col-span-1 space-y-2.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Payment Mode Starting Floats</span>
                                                {op.balances?.map((bal, idx) => (
                                                    <div key={idx} className="bg-white border border-slate-100 rounded-xl p-3 flex justify-between items-center shadow-sm">
                                                        <span className="text-xs font-bold text-slate-600">{bal.mode_of_payment}</span>
                                                        <span className="text-xs font-black text-slate-800">AED {bal.opening_amount.toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* UAE currency Denominations list */}
                                            <div className="lg:col-span-2 space-y-2.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Counted Opening Cash Denominations</span>
                                                {op.denominations?.length === 0 ? (
                                                    <div className="text-xs font-semibold text-slate-400 py-3">No denominations detail recorded.</div>
                                                ) : (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                        {op.denominations?.map((den, idx) => (
                                                            <div key={idx} className="bg-white border border-slate-100 rounded-lg p-2 text-center shadow-inner">
                                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{den.denomination} AED</span>
                                                                <span className="block text-xs font-black text-slate-800 mt-1">{den.count} <span className="text-[9px] text-slate-400">qty</span></span>
                                                                <span className="block text-[8px] font-bold text-indigo-600 bg-indigo-50 mt-1 rounded py-0.5">AED {den.amount.toFixed(2)}</span>
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

                    {/* Section 3: Shifts Closed (Prints always, but active dynamically on tab in UI) */}
                    <div className={`${activeTab === 'closings' ? 'block' : 'hidden print:block'} bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6`}>
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 border-b border-slate-100 pb-3">
                            <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                            Register Shifts Closed & Reconciled
                        </h3>

                        {data.closings?.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 font-semibold text-sm">
                                No shifts closed on this date.
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {data.closings?.map((cl) => (
                                    <div key={cl.name} className="border border-slate-100 rounded-2xl p-5 bg-slate-50/40 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-slate-900">{cl.name}</span>
                                                <span className="bg-slate-100 text-slate-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                    Link Opening: {cl.pos_opening_entry}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
                                                <div className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /> Closed By: <b>{cl.user?.split('@')[0]}</b></div>
                                                <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> Closed at: <b>{new Date(cl.period_end_date).toLocaleTimeString()}</b></div>
                                                <div className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5 text-slate-400" /> Profile: <b>{cl.pos_profile}</b></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            {/* Reconciliation breakdown details */}
                                            <div className="lg:col-span-2 space-y-4">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Payment Mode Reconciliation</span>
                                                <div className="overflow-x-auto bg-white border border-slate-100 rounded-xl shadow-sm">
                                                    <table className="w-full text-left border-collapse text-[11px]">
                                                        <thead>
                                                            <tr className="bg-slate-50/80 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                <th className="py-2.5 px-3">Mode</th>
                                                                <th className="py-2.5 px-3 text-right">Opening Float</th>
                                                                <th className="py-2.5 px-3 text-right">Expected Total</th>
                                                                <th className="py-2.5 px-3 text-right">Counted Actual</th>
                                                                <th className="py-2.5 px-3 text-right">Variance</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                                            {cl.reconciliation?.map((r, rIdx) => (
                                                                <tr key={rIdx}>
                                                                    <td className="py-2.5 px-3 font-bold">{r.mode_of_payment}</td>
                                                                    <td className="py-2.5 px-3 text-right">{(r.opening_amount || 0).toFixed(2)}</td>
                                                                    <td className="py-2.5 px-3 text-right font-semibold">{(r.expected_amount || 0).toFixed(2)}</td>
                                                                    <td className="py-2.5 px-3 text-right font-black text-slate-800">{(r.closing_amount || 0).toFixed(2)}</td>
                                                                    <td className={`py-2.5 px-3 text-right font-black ${
                                                                        r.difference > 0 ? 'text-rose-600' : r.difference < 0 ? 'text-emerald-600' : 'text-slate-400'
                                                                    }`}>
                                                                        {r.difference !== 0 ? (r.difference > 0 ? `-${r.difference.toFixed(2)}` : `+${Math.abs(r.difference).toFixed(2)}`) : '0.00'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Discrepancy Reason */}
                                                {cl.discrepancy_reason && (
                                                    <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 space-y-1">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 block">Variance Comment / Discrepancy Reason</span>
                                                        <p className="text-xs font-semibold text-rose-700 m-0">"{cl.discrepancy_reason}"</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* UAE currency closing denominations counted list */}
                                            <div className="lg:col-span-1 space-y-2.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Counted Closing Cash Denominations</span>
                                                {cl.denominations?.length === 0 ? (
                                                    <div className="text-xs font-semibold text-slate-400 py-3">No closing cash counted denominations recorded.</div>
                                                ) : (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {cl.denominations?.map((den, idx) => (
                                                            <div key={idx} className="bg-white border border-slate-100 rounded-lg p-2 text-center shadow-inner">
                                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{den.denomination} AED</span>
                                                                <span className="block text-xs font-black text-slate-800 mt-1">{den.count} <span className="text-[9px] text-slate-400">qty</span></span>
                                                                <span className="block text-[8px] font-bold text-emerald-600 bg-emerald-50 mt-1 rounded py-0.5">AED {den.amount.toFixed(2)}</span>
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
        </div>
    );
}

export default DailySalesReport;
