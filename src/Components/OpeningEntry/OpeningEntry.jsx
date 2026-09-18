import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Calendar, DollarSign, User, Building2, CreditCard, Plus, Trash2, Check, X, Store, Wallet, Banknote, Coins, ArrowLeft, FileText, Printer } from 'lucide-react';
import { db } from '../../db';
import POSService from '../../utils/posService';
import { frappeCall } from '../../utils/frappe';
import './OpeningEntryDetail.css';

const UAE_DENOMINATIONS = [
    { value: 1000, label: '1000 AED (Note)' },
    { value: 500, label: '500 AED (Note)' },
    { value: 200, label: '200 AED (Note)' },
    { value: 100, label: '100 AED (Note)' },
    { value: 50, label: '50 AED (Note)' },
    { value: 20, label: '20 AED (Note)' },
    { value: 10, label: '10 AED (Note)' },
    { value: 5, label: '5 AED (Note)' },
    { value: 1, label: '1 AED (Coin)' },
    { value: 0.50, label: '0.50 AED (Coin)' },
    { value: 0.25, label: '0.25 AED (Coin)' }
];

function OpeningEntry({ company: propCompany, posProfile: propPosProfile, user: propUser, onOpeningEntrySuccess, isModal, onCancel }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: routeId } = useParams();
    const userData = useSelector((state) => state.user);

    const getCurrentISTDateTime = () => {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istTime = new Date(now.getTime() + istOffset);
        return istTime.toISOString().slice(0, 16);
    };

    const [periodStartDate, setPeriodStartDate] = useState(getCurrentISTDateTime());
    const [postingDate, setPostingDate] = useState(getCurrentISTDateTime());
    const [company, setCompany] = useState(propCompany || '');
    const [user, setUser] = useState(propUser || '');
    const [posProfile, setPosProfile] = useState(propPosProfile || '');
    const [balanceDetails, setBalanceDetails] = useState([{ mode_of_payment: 'Cash', opening_amount: '0.00' }]);
    const [loading, setLoading] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);

    // UAE Denominations counts
    const [denomCounts, setDenomCounts] = useState(
        UAE_DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.value]: 0 }), {})
    );

    useEffect(() => {
        if (routeId) {
            setIsReadOnly(true);
            const fetchEntry = async () => {
                try {
                    setLoading(true);
                    const res = await frappeCall({
                        method: 'kyle_retail.retail_api.api.get_opening_entry_details',
                        args: { name: routeId },
                        type: 'POST'
                    });
                    if (res?.status === 'success' && res.data) {
                        const entry = res.data;
                        setUser(entry.user || '');
                        setPosProfile(entry.pos_profile || '');
                        setCompany(entry.company || '');
                        if (entry.period_start_date) setPeriodStartDate(entry.period_start_date);
                        if (entry.posting_date) setPostingDate(entry.posting_date);
                        if (entry.balance_details && entry.balance_details.length > 0) {
                            setBalanceDetails(entry.balance_details);
                        }
                    }
                } catch (err) {
                    console.error('Error fetching opening entry details:', err);
                } finally {
                    setLoading(false);
                }
            };
            fetchEntry();
            return;
        }

        const { user: navUser, pos_profile: navPosProfile, company: navCompany } = location.state || {};
        const reduxUser = userData?.user || localStorage.getItem('user') || '';
        const reduxPosProfile = userData?.posProfile || localStorage.getItem('pos_profile') || '';
        const reduxCompany = userData?.company || localStorage.getItem('company') || '';

        const activeUser = propUser || navUser || reduxUser;
        const activeProfile = propPosProfile || navPosProfile || reduxPosProfile;
        const activeCompany = propCompany || navCompany || reduxCompany;

        setUser(activeUser);
        setPosProfile(activeProfile);
        setCompany(activeCompany);

        // Fetch previous closing remaining cash
        const fetchPrevClosing = async () => {
            try {
                const session = localStorage.getItem('session') || '';
                const warehouse = localStorage.getItem('warehouse') || userData?.warehouse;
                const params = new URLSearchParams();
                if (activeProfile) params.append('pos_profile', activeProfile);
                if (warehouse) params.append('warehouse', warehouse);
                if (activeCompany) params.append('company', activeCompany);

                const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_previous_closing_balance?${params.toString()}`, {
                    headers: { 'X-Frappe-SID': session },
                    credentials: 'include'
                });
                const json = await res.json();
                const result = json.message || json;
                if (result.status === 'success' && result.has_previous) {
                    const prevCash = parseFloat(result.cash_amount) || 0;
                    setBalanceDetails([{ mode_of_payment: 'Cash', opening_amount: prevCash.toFixed(2) }]);

                    if (result.denominations && Object.keys(result.denominations).length > 0) {
                        setDenomCounts(prev => {
                            const updated = { ...prev };
                            Object.keys(result.denominations).forEach(k => {
                                const numKey = parseFloat(k);
                                updated[numKey] = parseInt(result.denominations[k]) || 0;
                            });
                            return updated;
                        });
                    }
                }
            } catch (e) {
                console.warn('Could not auto-fetch previous closing cash:', e);
            }
        };

        if (!routeId) {
            fetchPrevClosing();
        }
    }, [routeId, location.state, userData, propCompany, propPosProfile, propUser]);

    const handleAddBalanceDetail = () => {
        setBalanceDetails((prev) => [...prev, { mode_of_payment: '', opening_amount: '' }]);
    };

    const handleBalanceDetailChange = (index, field, value) => {
        setBalanceDetails((prev) =>
            prev.map((detail, i) => (i === index ? { ...detail, [field]: value } : detail))
        );
    };

    const handleRemoveBalanceDetail = (index) => {
        setBalanceDetails((prev) => prev.filter((_, i) => i !== index));
    };

    const handleDenomChange = (val, countStr) => {
        const count = parseInt(countStr) || 0;
        const newCounts = { ...denomCounts, [val]: count };
        setDenomCounts(newCounts);

        const totalCash = Object.keys(newCounts).reduce((sum, k) => {
            return sum + (parseFloat(k) * (newCounts[k] || 0));
        }, 0);

        setBalanceDetails((prev) => {
            const hasCash = prev.some((d) => d.mode_of_payment === 'Cash');
            if (hasCash) {
                return prev.map((d) =>
                    d.mode_of_payment === 'Cash' ? { ...d, opening_amount: totalCash.toFixed(2) } : d
                );
            } else {
                return [{ mode_of_payment: 'Cash', opening_amount: totalCash.toFixed(2) }, ...prev];
            }
        });
    };

    const handleSubmit = async () => {
        const missingFields = [];
        if (!periodStartDate) missingFields.push('Period Start Date');
        if (!postingDate) missingFields.push('Posting Date');
        if (!company) missingFields.push('Company');
        if (!user) missingFields.push('User');
        if (!posProfile) missingFields.push('POS Profile');
        if (
            balanceDetails.length === 0 ||
            balanceDetails.some(
                (d) => !d.mode_of_payment || d.opening_amount === '' || parseFloat(d.opening_amount) < 0
            )
        ) {
            missingFields.push('Balance Details (complete all rows with valid amounts)');
        }

        if (missingFields.length > 0) {
            alert(`Please fill in the following required fields: ${missingFields.join(', ')}`);
            return;
        }

        setLoading(true);
        const livePeriodStartDate = getCurrentISTDateTime();

        const formattedDenoms = Object.keys(denomCounts)
            .filter((k) => (denomCounts[k] || 0) > 0)
            .map((k) => ({
                denomination: parseFloat(k),
                count: parseInt(denomCounts[k]) || 0,
                amount: parseFloat(k) * (parseInt(denomCounts[k]) || 0)
            }));

        const payload = {
            period_start_date: livePeriodStartDate,
            posting_date: postingDate,
            company,
            user,
            pos_profile: posProfile,
            balance_details: balanceDetails.map((d) => ({
                mode_of_payment: d.mode_of_payment,
                opening_amount: parseFloat(d.opening_amount)
            })),
            opening_denominations: JSON.stringify(formattedDenoms),
            status: 'Open',
            docstatus: 1
        };
        console.log('OpeningEntry - Payload:', payload);

        try {
            if (!navigator.onLine) {
                const dummyId = `OFFLINE-SHIFT-${new Date().getTime()}`;
                const offlineEntry = {
                    ...payload,
                    offline_id: dummyId,
                    is_synced: 0,
                    timestamp: new Date().toISOString()
                };

                await db.opening_entries.add(offlineEntry);

                if (onOpeningEntrySuccess) {
                    onOpeningEntrySuccess(dummyId, company, posProfile);
                } else {
                    localStorage.setItem('posOpeningEntry', dummyId);
                    localStorage.setItem('company', company);
                    localStorage.setItem('pos_profile', posProfile);
                    alert(`Offline Shift Started: ${dummyId}. It will be synced automatically when online.`);
                    navigate('/homepage', {
                        state: { posOpeningEntry: dummyId, company, pos_profile: posProfile }
                    });
                }
                setLoading(false);
                return;
            }

            const responseData = await POSService.createOpeningEntry(payload);

            if (responseData && (responseData.status === 'success' || responseData.name)) {
                const posOpeningEntry = responseData.name;
                if (onOpeningEntrySuccess) {
                    onOpeningEntrySuccess(posOpeningEntry, company, posProfile);
                } else {
                    localStorage.setItem('posOpeningEntry', posOpeningEntry);
                    localStorage.setItem('company', company);
                    localStorage.setItem('pos_profile', posProfile);
                    alert(`POS Opening Entry created successfully: ${posOpeningEntry}`);
                    navigate('/homepage', {
                        state: {
                            posOpeningEntry,
                            company,
                            pos_profile: posProfile
                        }
                    });
                }
            } else {
                const errorMessage = responseData?.message || 'Unknown error occurred';
                alert(`Failed to create POS Opening Entry: ${errorMessage}`);
            }
        } catch (error) {
            console.error('OpeningEntry Network Error:', error);
            alert(`Network error occurred while creating POS Opening Entry: ${error.message || ''}`);
        } finally {
            setLoading(false);
        }
    };

    const totalAmount = balanceDetails.reduce((sum, detail) => sum + (parseFloat(detail.opening_amount) || 0), 0);

    if (isModal) {
        return (
            <div className="p-5 md:p-6 space-y-4">
                {/* Session Metadata Bar */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">Cashier</span>
                            <span className="block text-xs font-bold text-slate-700 truncate" title={user || 'N/A'}>{user || 'N/A'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">Company</span>
                            <span className="block text-xs font-bold text-slate-700 truncate" title={company || 'N/A'}>{company || 'N/A'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">POS Profile</span>
                            <span className="block text-xs font-bold text-slate-700 truncate" title={posProfile || 'N/A'}>{posProfile || 'N/A'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400 truncate">Posting Date</span>
                            <span className="block text-xs font-bold text-slate-700 truncate">
                                {postingDate ? new Date(postingDate).toLocaleDateString() : 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* UAE Cash Denominations Counting Grid */}
                <div className="border-t border-slate-100 pt-4">
                    <h2 className="text-sm font-black text-slate-800 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <DirhamIcon size={14} className="text-blue-500" />
                        UAE Cash Denomination Count
                    </h2>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
                            {UAE_DENOMINATIONS.map((d) => {
                                const count = denomCounts[d.value] || 0;
                                const total = d.value * count;
                                const isNote = d.value >= 5;
                                return (
                                    <div
                                        key={d.value}
                                        className={`bg-white rounded-xl p-2 border-2 transition-all flex flex-col justify-between relative overflow-hidden group ${count > 0
                                            ? 'border-blue-500 shadow-sm shadow-blue-500/5'
                                            : 'border-slate-100 hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="absolute -right-2 -top-2 w-8 h-8 bg-slate-50 rounded-full group-hover:scale-125 transition-transform duration-300"></div>

                                        <div className="relative">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[14px] font-black text-slate-800 tracking-tight">
                                                    {d.value} <span className="text-[9px] text-slate-400 font-bold">AED</span>
                                                </span>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${isNote ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                    {isNote ? 'Note' : 'Coin'}
                                                </span>
                                            </div>

                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    placeholder="0"
                                                    value={denomCounts[d.value] || ''}
                                                    onChange={(e) => handleDenomChange(d.value, e.target.value)}
                                                    className="w-full px-2 py-1 text-[13px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-bold text-slate-800 text-center"
                                                />
                                            </div>
                                        </div>

                                        {count > 0 && (
                                            <div className="mt-1.5 pt-1.5 border-t border-slate-50 flex items-center justify-center">
                                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full tracking-wider">
                                                    Total: {(total).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <h2 className="text-sm font-black text-slate-800 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <DirhamIcon size={14} className="text-emerald-500" />
                        Opening Payment Mode Balances
                    </h2>

                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-3" >
                        {balanceDetails.map((detail, index) => (
                            <div key={index} className="bg-white rounded-lg p-3 shadow-sm border border-slate-200/60 relative">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Mode of Payment
                                        </label>
                                        <select
                                            value={detail.mode_of_payment}
                                            onChange={(e) => handleBalanceDetailChange(index, 'mode_of_payment', e.target.value)}
                                            className="w-full px-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all outline-none bg-white font-medium"
                                            style={{ height: '42px', boxSizing: 'border-box' }}
                                        >
                                            <option value="">Select payment mode</option>
                                            <option value="Cash" disabled={index > 0 || detail.mode_of_payment === 'Cash'}>Cash</option>
                                            <option value="Credit Card">Credit Card</option>
                                            <option value="UPI">UPI</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Opening Amount
                                        </label>
                                        <div className="flex gap-2 items-center">
                                            <div className="flex-1 relative">
                                                <div className="absolute inset-y-0 left-0 p-3 flex items-center pointer-events-none">
                                                    <DirhamIcon size={12} className="text-slate-400 font-bold" />
                                                </div>
                                                <input
                                                    type="number"
                                                    value={detail.opening_amount}
                                                    onChange={(e) => handleBalanceDetailChange(index, 'opening_amount', e.target.value)}
                                                    disabled={detail.mode_of_payment === 'Cash'}
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className={`w-full pr-4 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all outline-none font-semibold text-slate-800 ${detail.mode_of_payment === 'Cash' ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-black' : ''}`}
                                                    style={{ paddingLeft: '2.5rem', height: '42px', boxSizing: 'border-box' }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleRemoveBalanceDetail(index)}
                                                disabled={balanceDetails.length === 1 || detail.mode_of_payment === 'Cash'}
                                                className="px-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center font-medium border border-rose-100"
                                                style={{ height: '42px', boxSizing: 'border-box' }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleAddBalanceDetail}
                            className="w-full py-2 border border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-700 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-wider bg-slate-50/50"
                        >
                            <Plus className="w-3 h-3" />
                            Add Payment Mode
                        </button>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between shadow-sm">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Opening Amount</span>
                        <div className="text-slate-400 text-xs font-bold mt-0.5 flex items-center gap-1"><DirhamIcon size={11} /> United Arab Emirates Dirham</div>
                    </div>
                    <span className="text-2xl font-black text-emerald-400 flex items-center gap-1.5"><DirhamIcon size={18} /> {totalAmount.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-5 mt-6">
                    <button
                        type="button"
                        onClick={onCancel || (() => navigate('/'))}
                        className="h-[44px] px-5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-[15px] tracking-normal rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 flex items-center justify-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                        <X className="w-[18px] h-[18px] text-slate-500 shrink-0" />
                        <span>Cancel / Exit</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="h-[44px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[15px] tracking-normal rounded-xl shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                        {loading ? (
                            <>
                                <div className="w-[18px] h-[18px] border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></div>
                                <span>Opening Shift...</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-[18px] h-[18px] stroke-[2.5] shrink-0" />
                                <span>Start POS Session</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    const formatDisplayDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const day = d.getDate();
            const month = d.toLocaleString('en-US', { month: 'short' });
            const year = d.getFullYear();
            let hours = d.getHours();
            const minutes = d.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'pm' : 'am';
            hours = hours % 12 || 12;
            const paddedHours = hours.toString().padStart(2, '0');
            return `${day} ${month} ${year}, ${paddedHours}:${minutes} ${ampm}`;
        } catch (e) {
            return dateStr;
        }
    };

    if (isReadOnly || routeId) {
        return (
            <div className="pos-ope-page-wrapper">
                {/* 1. TOP HEADER BAR */}
                <div className="pos-ope-header-bar">
                    <div className="pos-ope-header-left">
                        <button className="pos-ope-back-btn" onClick={() => navigate('/posopeningentrylist')} title="Back to List">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="pos-ope-title-group">
                            <div className="pos-ope-title-row">
                                <h1 className="pos-ope-title">{routeId || 'POS OPENING ENTRY'}</h1>
                                <span className="pos-ope-badge">
                                    <span className="pos-ope-badge-dot"></span>
                                    SUBMITTED / OPEN
                                </span>
                            </div>
                            <p className="pos-ope-subtitle">Point of Sale Shift Opening Entry Record</p>
                        </div>
                    </div>

                    <div className="pos-ope-header-right">
                        <button className="pos-ope-btn-secondary" onClick={() => window.print()}>
                            <Printer size={14} /> Print
                        </button>
                        <button className="pos-ope-btn-secondary" onClick={() => navigate('/posopeningentrylist')}>
                            <ArrowLeft size={14} /> Back to List
                        </button>
                    </div>
                </div>

                {/* 2. PAGE CONTENT AREA */}
                <div className="pos-ope-container">
                    <div className="pos-ope-content-grid">

                        {/* CARD 1: OPENING ENTRY INFORMATION */}
                        <div className="pos-ope-card">
                            <div className="pos-ope-card-header">
                                <div className="pos-ope-card-title">
                                    <FileText className="pos-ope-card-icon" size={18} /> OPENING ENTRY INFORMATION
                                </div>
                            </div>
                            <div className="pos-ope-card-body">
                                <div className="pos-ope-meta-grid">
                                    <div className="pos-ope-info-item">
                                        <div className="pos-ope-info-icon">
                                            <User size={18} />
                                        </div>
                                        <div className="pos-ope-info-details">
                                            <span className="pos-ope-info-label">CASHIER / USER</span>
                                            <span className="pos-ope-info-value">{user || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="pos-ope-info-item">
                                        <div className="pos-ope-info-icon">
                                            <Building2 size={18} />
                                        </div>
                                        <div className="pos-ope-info-details">
                                            <span className="pos-ope-info-label">COMPANY</span>
                                            <span className="pos-ope-info-value">{company || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="pos-ope-info-item">
                                        <div className="pos-ope-info-icon">
                                            <Store size={18} />
                                        </div>
                                        <div className="pos-ope-info-details">
                                            <span className="pos-ope-info-label">POS PROFILE</span>
                                            <span className="pos-ope-info-value">{posProfile || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="pos-ope-info-item">
                                        <div className="pos-ope-info-icon">
                                            <Calendar size={18} />
                                        </div>
                                        <div className="pos-ope-info-details">
                                            <span className="pos-ope-info-label">PERIOD START DATE</span>
                                            <span className="pos-ope-info-value">{formatDisplayDate(periodStartDate)}</span>
                                        </div>
                                    </div>

                                    <div className="pos-ope-info-item">
                                        <div className="pos-ope-info-icon">
                                            <Calendar size={18} />
                                        </div>
                                        <div className="pos-ope-info-details">
                                            <span className="pos-ope-info-label">POSTING DATE</span>
                                            <span className="pos-ope-info-value">{formatDisplayDate(postingDate)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CARD 2: OPENING PAYMENT MODE BALANCES */}
                        <div className="pos-ope-card">
                            <div className="pos-ope-card-header">
                                <div className="pos-ope-card-title">
                                    <Wallet className="pos-ope-card-icon" size={18} /> OPENING PAYMENT MODE BALANCES
                                </div>
                            </div>
                            <div className="pos-ope-card-body">
                                <div className="pos-ope-table-container">
                                    <table className="pos-ope-table">
                                        <thead>
                                            <tr>
                                                <th>MODE OF PAYMENT</th>
                                                <th style={{ textAlign: 'right' }}>OPENING AMOUNT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {balanceDetails.map((detail, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        <div className="pos-ope-payment-cell">
                                                            <div className="pos-ope-payment-icon">
                                                                <Banknote size={16} />
                                                            </div>
                                                            <span>{detail.mode_of_payment || 'Cash'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }} className="pos-ope-amount-cell">
                                                        AED {parseFloat(detail.opening_amount || 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* CARD 3: TOTAL SHIFT SUMMARY */}
                        <div className="pos-ope-total-card">
                            <div className="pos-ope-total-left">
                                <div className="pos-ope-total-icon">
                                    <Coins size={22} />
                                </div>
                                <div>
                                    <div className="pos-ope-total-title">Total Opening Shift Amount</div>
                                    <div className="pos-ope-total-sub">United Arab Emirates Dirham</div>
                                </div>
                            </div>
                            <div className="pos-ope-total-amount">
                                AED {totalAmount.toFixed(2)}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6">
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <DirhamIcon size={28} className="text-white" />
                            Create POS Opening Entry
                        </h1>
                        <p className="text-slate-200 mt-2">Initialize your point of sale system for the day</p>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                    Period Start Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={periodStartDate}
                                    onChange={(e) => setPeriodStartDate(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                    Posting Date & Time
                                </label>
                                <input
                                    type="datetime-local"
                                    value={postingDate}
                                    onChange={(e) => setPostingDate(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <Building2 className="w-4 h-4 text-slate-500" />
                                    Company
                                </label>
                                <input
                                    type="text"
                                    value={company}
                                    disabled
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <User className="w-4 h-4 text-slate-500" />
                                    User
                                </label>
                                <input
                                    type="text"
                                    value={user}
                                    disabled
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <CreditCard className="w-4 h-4 text-slate-500" />
                                    POS Profile
                                </label>
                                <input
                                    type="text"
                                    value={posProfile}
                                    disabled
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* UAE Denominations Calculator */}
                        {!isReadOnly && (
                            <div className="mb-8 border-t border-slate-200 pt-6">
                                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <DirhamIcon size={18} className="text-blue-600" />
                                    UAE Opening Cash Denominations (Optional Calculator)
                                </h2>
                                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {UAE_DENOMINATIONS.map((d) => (
                                            <div key={d.value} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                                                <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                                                    <DirhamIcon size={11} className="text-slate-400" />
                                                    {d.label}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="0"
                                                        value={denomCounts[d.value] || ''}
                                                        onChange={(e) => handleDenomChange(d.value, e.target.value)}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-semibold"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <DirhamIcon size={18} className="text-emerald-500" />
                                Payment Mode Balances
                            </h2>
                            <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                                {balanceDetails.map((detail, index) => (
                                    <div key={index} className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Mode of Payment
                                                </label>
                                                <select
                                                    value={detail.mode_of_payment}
                                                    onChange={(e) => handleBalanceDetailChange(index, 'mode_of_payment', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full px-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                                    style={{ height: '42px', boxSizing: 'border-box' }}
                                                >
                                                    <option value="">Select payment mode</option>
                                                    <option value="Cash" disabled={index > 0 || detail.mode_of_payment === 'Cash'}>Cash</option>
                                                    <option value="Credit Card">Credit Card</option>
                                                    <option value="UPI">UPI</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">
                                                    Opening Amount
                                                </label>
                                                <div className="flex gap-2 items-center">
                                                    <div className="flex-1 relative">
                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                            <DirhamIcon size={12} className="text-slate-400 font-bold" />
                                                        </div>
                                                        <input
                                                            type="number"
                                                            value={detail.opening_amount}
                                                            onChange={(e) => handleBalanceDetailChange(index, 'opening_amount', e.target.value)}
                                                            disabled={isReadOnly || detail.mode_of_payment === 'Cash'}
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            className={`w-full pr-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all outline-none font-semibold ${detail.mode_of_payment === 'Cash' || isReadOnly ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                                            style={{ paddingLeft: '2.5rem', height: '42px', boxSizing: 'border-box' }}
                                                        />
                                                    </div>
                                                    {!isReadOnly && (
                                                        <button
                                                            onClick={() => handleRemoveBalanceDetail(index)}
                                                            disabled={balanceDetails.length === 1 || detail.mode_of_payment === 'Cash'}
                                                            className="px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
                                                            style={{ height: '42px', boxSizing: 'border-box' }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {!isReadOnly && (
                                    <button
                                        onClick={handleAddBalanceDetail}
                                        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:bg-white hover:text-slate-700 transition-all flex items-center justify-center gap-2 font-medium"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Add Payment Mode
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 mb-8">
                            <div className="flex items-center justify-between text-white">
                                <span className="text-lg font-semibold">Total Opening Amount</span>
                                <span className="text-3xl font-bold flex items-center gap-1.5"><DirhamIcon size={24} /> {totalAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-end">
                            <button
                                onClick={() => navigate('/posopeningentrylist')}
                                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                                Back to List
                            </button>
                            {!isReadOnly && (
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="px-8 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-lg font-semibold hover:from-slate-700 hover:to-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Submit Opening Entry
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OpeningEntry;