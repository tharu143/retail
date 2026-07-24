import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Filter, RefreshCw, Printer, ChevronDown, 
    TrendingUp, DollarSign, Clock, User, Shield, CreditCard, ChevronRight, HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { ExternalLink } from 'lucide-react';
import '../Admin/SalesOrder.css';

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
        <div className="so-page" style={{ overflowY: 'auto', height: '100%', maxHeight: '100vh' }}>
            
            {/* Header section */}
            <div className="so-page-header no-print">
                <div>
                    <h1 className="so-page-title flex items-center gap-2">
                        <FileText size={22} style={{ color: '#604BE8' }} />
                        Daily Shift & Sales Report
                    </h1>
                    <p className="so-page-subtitle">Shift float opening counts, daily sales payments, and closing reconciliations</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlePrint}
                        className="so-btn-secondary"
                        style={{ height: '38px', padding: '0 1rem' }}
                    >
                        <Printer className="w-4 h-4" /> Print Report
                    </button>
                    <button 
                        onClick={fetchDailyReport}
                        className="so-btn-secondary"
                        style={{ height: '38px', padding: '0 1rem' }}
                    >
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
            </div>

            {/* Print Only Header */}
            <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6" style={{ padding: '1rem 2rem' }}>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Daily Shift & Sales Report</h1>
                <div className="mt-2 grid grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                    <div>Date: {selectedDate}</div>
                    <div>Branch: {isAdmin ? (selectedBranch || 'All Branches') : warehouse}</div>
                </div>
            </div>

            <div className="so-layout">
                {/* Filters Bar */}
                <div className="so-filter-bar no-print" style={{ padding: '1rem 2rem', gap: '1.5rem' }}>
                    {/* Date Input - Clicking anywhere on this input block opens the datepicker */}
                    <div style={{ flex: '1 1 200px' }}>
                        <label className="so-filter-label">Select Date</label>
                        <div className="so-relative">
                            <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#604BE8' }} />
                            <input 
                                ref={dateInputRef}
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="so-filter-input so-filter-input-icon"
                                onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                                onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                            />
                        </div>
                    </div>

                    {/* Branch Selection */}
                    {isAdmin ? (
                        <div style={{ flex: '1 1 250px' }}>
                            <label className="so-filter-label">Branch / Warehouse</label>
                            <div className="so-relative">
                                <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="so-filter-select so-filter-input-icon"
                                >
                                    <option value="">All Branches</option>
                                    {warehouses.map(w => (
                                        <option key={w.value} value={w.value}>{w.label}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }} />
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: '1 1 250px' }}>
                            <label className="so-filter-label">Active Branch</label>
                            <div style={{
                                height: '42px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#f8fafc',
                                border: '1.5px solid #e2e8f0',
                                borderRadius: '12px',
                                padding: '0 12px',
                                fontSize: '14px',
                                fontWeight: 700,
                                color: '#475569'
                            }}>
                                <Shield size={14} style={{ color: '#604BE8' }} />
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
                        className="so-clear-btn"
                        style={{ height: '42px', width: 'auto', padding: '0 1.5rem', margin: 0 }}
                    >
                        Reset to Today
                    </button>
                </div>

                <main className="so-content" style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-semibold shadow-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                    <span>{error}</span>
                </div>
            )}

            {/* Metrics cards bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {/* 1. Total POS Revenue */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between border-l-4 border-l-indigo-600">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total POS Revenue</span>
                    <span className="text-base font-black text-slate-800 mt-1 flex items-center gap-1">
                        <DirhamIcon size={13} /> {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Net Total: AED {totals.netTotal.toFixed(2)}
                    </span>
                </div>

                {/* 2. Cash Payments */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cash Payments</span>
                    <span className="text-base font-black text-emerald-600 mt-1 flex items-center gap-1">
                        <DirhamIcon size={13} /> {totals.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[8.5px] font-bold text-emerald-600 uppercase tracking-widest mt-1">
                        Physical Cash Sales
                    </span>
                </div>

                {/* 3. Card Payments */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between border-l-4 border-l-blue-500">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Card Payments</span>
                    <span className="text-base font-black text-blue-600 mt-1 flex items-center gap-1">
                        <DirhamIcon size={13} /> {totals.card.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[8.5px] font-bold text-blue-500 uppercase tracking-widest mt-1">
                        Credit & Debit Cards
                    </span>
                </div>

                {/* 4. InstaPay Payments */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between border-l-4 border-l-cyan-500">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">InstaPay Payments</span>
                    <span className="text-base font-black text-cyan-600 mt-1 flex items-center gap-1">
                        <DirhamIcon size={13} /> {totals.instapay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[8.5px] font-bold text-cyan-600 uppercase tracking-widest mt-1">
                        InstaPay Transactions
                    </span>
                </div>

                {/* 5. Credit Sales */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between border-l-4 border-l-amber-500">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Credit Sales</span>
                    <span className="text-base font-black text-amber-600 mt-1 flex items-center gap-1">
                        <DirhamIcon size={13} /> {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[8.5px] font-bold text-amber-600 uppercase tracking-widest mt-1">
                        Outstanding Credit Sales
                    </span>
                </div>

                {/* 6. Loyalty Points Redeemed */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between border-l-4 border-l-purple-500">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Loyalty Points Redeemed</span>
                    <span className="text-base font-black text-purple-600 mt-1 flex items-center gap-1">
                        <DirhamIcon size={13} /> {totals.loyaltyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[8.5px] font-bold text-purple-600 uppercase tracking-widest mt-1">
                        Points Redeemed Value
                    </span>
                </div>

                {/* 7. Total Discounts Given */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between border-l-4 border-l-pink-500">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Discounts Given</span>
                    <span className="text-base font-black text-pink-600 mt-1 flex items-center gap-1">
                        <DirhamIcon size={13} /> {totals.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[8.5px] font-bold text-pink-600 uppercase tracking-widest mt-1">
                        Customer Price Discounts
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
                                        <tr className="border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                                            <th className="py-3 px-4 border border-slate-200">Invoice ID</th>
                                            <th className="py-3 px-4 border border-slate-200">Customer</th>
                                            <th className="py-3 px-4 border border-slate-200">Cashier</th>
                                            <th className="py-3 px-4 border border-slate-200">Time</th>
                                            <th className="py-3 px-4 border border-slate-200">Payment Breakdown</th>
                                            <th className="py-3 px-4 text-right border border-slate-200">Grand Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {data.invoices?.map((inv) => (
                                            <tr key={inv.name} className="hover:bg-slate-50/40 text-slate-700">
                                                <td className="py-3 px-4 font-bold border border-slate-200">
                                                    <span onClick={() => navigate('/salesinvoicelist', { state: { search: inv.name } })} className="group flex items-center gap-1.5 hover:text-indigo-600 transition-colors underline-offset-4 hover:underline cursor-pointer text-slate-900" style={{ fontFamily: 'monospace' }}>
                                                        {inv.name}
                                                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-semibold border border-slate-200">{inv.customer_name}</td>
                                                <td className="py-3 px-4 border border-slate-200">{inv.owner?.split('@')[0]}</td>
                                                <td className="py-3 px-4 text-slate-500 border border-slate-200">{inv.posting_time}</td>
                                                <td className="py-3 px-4 border border-slate-200">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {inv.payments?.map((p, pIdx) => (
                                                            <span key={pIdx} className="bg-slate-50 border border-slate-200/60 rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                                                {p.mode_of_payment}: {p.amount.toFixed(2)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-slate-900 border border-slate-200">
                                                    AED {inv.grand_total.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-2 border-slate-200 font-black text-slate-800 bg-slate-50/50">
                                            <td className="py-3 px-4 text-[10px] font-black uppercase border border-slate-200">Total</td>
                                            <td className="py-3 px-4 border border-slate-200"></td>
                                            <td className="py-3 px-4 border border-slate-200"></td>
                                            <td className="py-3 px-4 border border-slate-200"></td>
                                            <td className="py-3 px-4 border border-slate-200">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {totals.cash > 0 && <span className="bg-emerald-50 border border-emerald-200/60 rounded-full px-2 py-0.5 text-[9px] font-bold text-emerald-700">Cash: {totals.cash.toFixed(2)}</span>}
                                                    {totals.card > 0 && <span className="bg-blue-50 border border-blue-200/60 rounded-full px-2 py-0.5 text-[9px] font-bold text-blue-700">Card: {totals.card.toFixed(2)}</span>}
                                                    {totals.bank > 0 && <span className="bg-purple-50 border border-purple-200/60 rounded-full px-2 py-0.5 text-[9px] font-bold text-purple-700">Bank: {totals.bank.toFixed(2)}</span>}
                                                    {totals.instapay > 0 && <span className="bg-amber-50 border border-amber-200/60 rounded-full px-2 py-0.5 text-[9px] font-bold text-amber-700">InstaPay: {totals.instapay.toFixed(2)}</span>}
                                                    {totals.credit > 0 && <span className="bg-rose-50 border border-rose-200/60 rounded-full px-2 py-0.5 text-[9px] font-bold text-rose-700">Credit: {totals.credit.toFixed(2)}</span>}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-slate-900 text-sm border border-slate-200">
                                                AED {totalRevenue.toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                                
                                {/* Summary of Payment Modes */}
                                <div className="mt-6 border-t border-slate-100 pt-6">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Daily Payment Mode Summary</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-center">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Cash</span>
                                            <span className="block text-sm font-black text-emerald-600 mt-1">AED {totals.cash.toFixed(2)}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-center">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Card</span>
                                            <span className="block text-sm font-black text-blue-600 mt-1">AED {totals.card.toFixed(2)}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-center">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Bank Transfer</span>
                                            <span className="block text-sm font-black text-purple-600 mt-1">AED {totals.bank.toFixed(2)}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-center">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">InstaPay Cash</span>
                                            <span className="block text-sm font-black text-amber-600 mt-1">AED {totals.instapay.toFixed(2)}</span>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-center col-span-2 sm:col-span-1">
                                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Credit</span>
                                            <span className="block text-sm font-black text-rose-600 mt-1">AED {totals.credit.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
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
                                                <span onClick={() => navigate('/openingentry', { state: { search: op.name } })} className="group flex items-center gap-1.5 text-sm font-black text-slate-900 hover:text-indigo-600 transition-colors underline-offset-4 hover:underline cursor-pointer">
                                                    {op.name}
                                                    <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                                </span>
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
                                                <span onClick={() => navigate('/closingentrylist', { state: { search: cl.name } })} className="group flex items-center gap-1.5 text-sm font-black text-slate-900 hover:text-indigo-600 transition-colors underline-offset-4 hover:underline cursor-pointer">
                                                    {cl.name}
                                                    <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                                </span>
                                                <span onClick={() => navigate('/openingentry', { state: { search: cl.pos_opening_entry } })} className="bg-slate-100 text-slate-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full cursor-pointer hover:bg-slate-200 transition-colors flex items-center gap-1">
                                                    Link Opening: {cl.pos_opening_entry}
                                                    <ExternalLink size={10} className="text-slate-400" />
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
                                                            <tr className="bg-slate-50/80 border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                                <th className="py-2.5 px-3 border border-slate-200">Mode</th>
                                                                <th className="py-2.5 px-3 text-right border border-slate-200">Opening Float</th>
                                                                <th className="py-2.5 px-3 text-right border border-slate-200">Expected Total</th>
                                                                <th className="py-2.5 px-3 text-right border border-slate-200">Counted Actual</th>
                                                                <th className="py-2.5 px-3 text-right border border-slate-200">Variance</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                                            {cl.reconciliation?.map((r, rIdx) => (
                                                                <tr key={rIdx}>
                                                                    <td className="py-2.5 px-3 font-bold border border-slate-200">{r.mode_of_payment}</td>
                                                                    <td className="py-2.5 px-3 text-right border border-slate-200">{(r.opening_amount || 0).toFixed(2)}</td>
                                                                    <td className="py-2.5 px-3 text-right font-semibold border border-slate-200">{(r.expected_amount || 0).toFixed(2)}</td>
                                                                    <td className="py-2.5 px-3 text-right font-black text-slate-800 border border-slate-200">{(r.closing_amount || 0).toFixed(2)}</td>
                                                                    <td className={`py-2.5 px-3 text-right font-black border border-slate-200 ${
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
            </main>
        </div>
        </div>
    );
}

export default DailySalesReport;
