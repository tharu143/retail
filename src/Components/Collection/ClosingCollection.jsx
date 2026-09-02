import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { 
    Wallet, Building2, Calendar, KeyRound, UserCheck, CreditCard, 
    Landmark, FileText, CheckCircle2, AlertCircle, Printer, RefreshCw, 
    History, ArrowRight, ShieldCheck, DollarSign, X, Check, Search, Receipt,
    Coins, Banknote, ArrowDownToLine, CheckCheck
} from 'lucide-react';
import Swal from 'sweetalert2';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './ClosingCollection.css';

function ClosingCollection() {
    const { warehouse, user_roles, user } = useSelector((state) => state.user || {});
    const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedBranch, setSelectedBranch] = useState(warehouse || '');
    const [branches, setBranches] = useState([]);
    
    // Balance Data
    const [loading, setLoading] = useState(false);
    const [balanceData, setBalanceData] = useState({
        closing_balance: 0,
        total_collected: 0,
        remaining_balance: 0,
        collections: [],
        bank_accounts: []
    });

    // Form Fields
    const [amount, setAmount] = useState('');
    const [secretCode, setSecretCode] = useState('');
    const [collectorName, setCollectorName] = useState('');
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);
    const [codeVerified, setCodeVerified] = useState(false);
    const [collectionType, setCollectionType] = useState('Cash'); // 'Cash' | 'Bank Transfer'
    const [bankAccount, setBankAccount] = useState('');
    const [bankingReference, setBankingReference] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [tableSearch, setTableSearch] = useState('');

    // Thermal Slip Print Preview Modal
    const [printDoc, setPrintDoc] = useState(null);
    const [showPrintModal, setShowPrintModal] = useState(false);

    const getSession = () => localStorage.getItem('session') || '';
    const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

    // 1. Fetch Warehouses if Admin
    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            const res = await fetch(`${API_PATH}.get_company_warehouses`, {
                headers: { 'X-Frappe-SID': getSession() },
                credentials: 'include'
            });
            if (res.ok) {
                const json = await res.json();
                const list = json.message || json.data || [];
                setBranches(list);
                if (!selectedBranch && list.length > 0) {
                    setSelectedBranch(list[0].name);
                }
            }
        } catch (err) {
            console.error("Failed to load warehouses:", err);
        }
    };

    // 2. Fetch Balance & Collections Data
    useEffect(() => {
        if (selectedBranch) {
            fetchCollectionData();
        }
    }, [selectedBranch, selectedDate]);

    const fetchCollectionData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                warehouse: selectedBranch,
                date: selectedDate
            });
            const res = await fetch(`${API_PATH}.get_branch_closing_collection_data?${params.toString()}`, {
                headers: { 'X-Frappe-SID': getSession() },
                credentials: 'include'
            });
            const json = await res.json();
            const result = json.message || json;
            if (result.status === 'success' && result.data) {
                setBalanceData(result.data);
                if (result.data.bank_accounts && result.data.bank_accounts.length > 0 && !bankAccount) {
                    setBankAccount(result.data.bank_accounts[0].name);
                }
            }
        } catch (err) {
            console.error("Failed to fetch balance data:", err);
        } finally {
            setLoading(false);
        }
    };

    // 3. Secret Code Lookup
    const handleSecretCodeChange = async (e) => {
        const val = e.target.value;
        setSecretCode(val);
        setCollectorName('');
        setCodeVerified(false);

        if (val.trim().length >= 3) {
            setIsVerifyingCode(true);
            try {
                const res = await fetch(`${API_PATH}.get_collector_by_secret_code?secret_code=${encodeURIComponent(val.trim())}`, {
                    headers: { 'X-Frappe-SID': getSession() },
                    credentials: 'include'
                });
                const json = await res.json();
                const result = json.message || json;
                if (result.status === 'success' && result.data) {
                    setCollectorName(result.data.collector_name);
                    setCodeVerified(true);
                }
            } catch (err) {
                console.error("Code verification error:", err);
            } finally {
                setIsVerifyingCode(false);
            }
        }
    };

    // Quick Fill remaining balance
    const handleFillMaxAmount = () => {
        setAmount(balanceData.remaining_balance > 0 ? balanceData.remaining_balance.toString() : '');
    };

    // 4. Submit Collection
    const handleSubmit = async (e) => {
        e.preventDefault();
        const enteredAmt = parseFloat(amount || 0);

        if (enteredAmt <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Invalid Amount',
                text: 'Please enter a valid collection amount greater than 0.'
            });
            return;
        }

        if (!collectorName && !secretCode) {
            Swal.fire({
                icon: 'warning',
                title: 'Collector Details Needed',
                text: 'Please provide a valid Secret Code or Collector / Employee Name.'
            });
            return;
        }

        if (collectionType === 'Bank Transfer' && !bankingReference) {
            Swal.fire({
                icon: 'warning',
                title: 'Reference Required',
                text: 'Please enter the Banking Reference / Voucher number for Bank Transfer.'
            });
            return;
        }

        const confirm = await Swal.fire({
            title: 'Confirm Collection?',
            html: `
                <div class="text-left py-2 space-y-1.5 text-xs text-slate-700 font-medium">
                    <p><strong>Branch:</strong> ${selectedBranch}</p>
                    <p><strong>Date:</strong> ${selectedDate}</p>
                    <p><strong>Collector:</strong> ${collectorName || 'Manual'}</p>
                    <p><strong>Amount:</strong> AED ${enteredAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p><strong>Mode:</strong> ${collectionType}</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Submit & Print',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#059669'
        });

        if (!confirm.isConfirmed) return;

        setSubmitting(true);
        try {
            const payload = {
                branch: selectedBranch,
                posting_date: selectedDate,
                amount: enteredAmt,
                collection_type: collectionType,
                secret_code: secretCode,
                collector_name: collectorName,
                bank_account: collectionType === 'Bank Transfer' ? bankAccount : null,
                banking_reference: collectionType === 'Bank Transfer' ? bankingReference : null,
                description: description
            };

            const res = await fetch(`${API_PATH}.create_branch_closing_collection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Frappe-SID': getSession()
                },
                credentials: 'include',
                body: JSON.stringify({ data: payload })
            });

            const json = await res.json();
            const result = json.message || json;

            if (result.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Collection Submitted!',
                    text: result.message || 'Collection recorded successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });

                // Reset inputs
                setAmount('');
                setSecretCode('');
                setCollectorName('');
                setCodeVerified(false);
                setBankingReference('');
                setDescription('');

                // Open thermal print slip
                if (result.doc) {
                    setPrintDoc(result.doc);
                    setShowPrintModal(true);
                }

                // Refresh data
                fetchCollectionData();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Failed to Submit',
                    text: result.message || 'Something went wrong.'
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: err.message
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Print Thermal Slip Window
    const handlePrintThermal = () => {
        const slipEl = document.getElementById('thermal-collection-slip');
        if (!slipEl) {
            window.print();
            return;
        }

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Branch Closing Collection Slip</title>
                        <style>
                            @page { size: 80mm auto; margin: 0; }
                            body {
                                width: 72mm;
                                margin: 0 auto;
                                padding: 8px 0;
                                font-family: 'Courier New', Courier, monospace;
                                font-size: 11px;
                                line-height: 1.2;
                                color: #000000;
                            }
                            .center { text-align: center; }
                            .bold { font-weight: bold; }
                            .divider { border-top: 1px dashed #000000; margin: 6px 0; }
                            .double-divider { border-top: 2px solid #000000; margin: 6px 0; }
                            .flex-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                        </style>
                    </head>
                    <body>
                        ${slipEl.innerHTML}
                        <script>
                            window.onload = function() {
                                window.print();
                                setTimeout(function() { window.close(); }, 500);
                            };
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        } else {
            window.print();
        }
    };

    const calculatedLiveRemaining = Math.max(0, (balanceData.remaining_balance || 0) - (parseFloat(amount) || 0));

    // Filter collections by search term
    const filteredCollections = useMemo(() => {
        const term = (tableSearch || '').toLowerCase().trim();
        if (!term) return balanceData.collections || [];
        return (balanceData.collections || []).filter(c => 
            (c.name || '').toLowerCase().includes(term) ||
            (c.collector_name || '').toLowerCase().includes(term) ||
            (c.secret_code || '').toLowerCase().includes(term) ||
            (c.collection_type || '').toLowerCase().includes(term) ||
            (c.banking_reference || '').toLowerCase().includes(term)
        );
    }, [balanceData.collections, tableSearch]);

    return (
        <div className="closing-collection-root">
            <div className="closing-collection-container space-y-5">
                
                {/* ── 1. CLEAN TOP HEADER (NO REDUNDANT DASHBOARD BUTTON) ── */}
                <div className="cc-card p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-200 flex items-center justify-center shrink-0">
                            <Wallet size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-tight">
                                Branch Closing Amount Collection
                            </h1>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Track daily closing balances, collect funds with secret PIN verification & print thermal slips
                            </p>
                        </div>
                    </div>

                    {/* Compact Filter Bar */}
                    <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                        {isAdmin && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                                <Building2 size={15} className="text-slate-500 shrink-0" />
                                <select 
                                    value={selectedBranch} 
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer pr-1"
                                >
                                    {branches.map((b) => (
                                        <option key={b.name} value={b.name}>
                                            {b.warehouse_name || b.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <Calendar size={15} className="text-slate-500 shrink-0" />
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
                            />
                        </div>

                        <button 
                            onClick={fetchCollectionData} 
                            disabled={loading}
                            className="p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 bg-slate-100 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
                            title="Refresh Data"
                        >
                            <RefreshCw size={15} className={loading ? "animate-spin text-emerald-600" : ""} />
                        </button>
                    </div>
                </div>

                {/* ── 2. 3 ELEVATED METRIC CARDS ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Total Closing Balance */}
                    <div className="kpi-metric-card kpi-metric-blue cc-card">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Total Closing Balance</span>
                            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                                <Coins size={16} />
                            </div>
                        </div>
                        <div className="my-2.5">
                            <div className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-1.5">
                                <DirhamIcon size={20} className="text-slate-700" />
                                {(balanceData.closing_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span>From POS shift closing / daily sales</span>
                        </div>
                    </div>

                    {/* Total Collected Today */}
                    <div className="kpi-metric-card kpi-metric-amber cc-card">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">Total Collected Today</span>
                            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                                <History size={16} />
                            </div>
                        </div>
                        <div className="my-2.5">
                            <div className="text-2xl md:text-3xl font-black text-amber-700 flex items-center gap-1.5">
                                <DirhamIcon size={20} className="text-amber-700" />
                                {(balanceData.total_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>{balanceData.collections?.length || 0} handover transaction(s) recorded</span>
                        </div>
                    </div>

                    {/* Remaining to Collect */}
                    <div className="kpi-metric-card kpi-metric-emerald cc-card">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">Remaining to Collect</span>
                            <div className="p-2 bg-emerald-200/80 text-emerald-800 rounded-xl">
                                <CheckCircle2 size={16} />
                            </div>
                        </div>
                        <div className="my-2.5">
                            <div className="text-2xl md:text-3xl font-black text-emerald-800 flex items-center gap-1.5">
                                <DirhamIcon size={20} className="text-emerald-800" />
                                {(balanceData.remaining_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Pending at branch counter
                            </span>
                            {balanceData.remaining_balance > 0 && (
                                <button
                                    onClick={handleFillMaxAmount}
                                    className="text-[11px] font-extrabold text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                                >
                                    Quick Fill
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── 3. MAIN WORKSPACE GRID: FORM (LEFT) & HISTORY TABLE (RIGHT) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    
                    {/* LEFT: Record New Collection Form (5 Cols) */}
                    <div className="lg:col-span-5 cc-card p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                                    <ArrowDownToLine size={16} />
                                </div>
                                <h2 className="text-sm font-black text-slate-800">
                                    Record Handover
                                </h2>
                            </div>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {selectedBranch || 'Branch'}
                            </span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3.5">
                            {/* Collection Amount */}
                            <div className="cc-form-group">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700">
                                        Collection Amount (AED) <span className="text-rose-500">*</span>
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={handleFillMaxAmount}
                                        className="text-[11px] font-extrabold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer transition-all"
                                    >
                                        Fill Max ({(balanceData.remaining_balance || 0).toLocaleString()})
                                    </button>
                                </div>
                                <div className="cc-input-wrapper">
                                    <div className="cc-field-icon">
                                        <DirhamIcon size={15} />
                                    </div>
                                    <input 
                                        type="number"
                                        step="any"
                                        min="0.01"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="cc-custom-input with-icon text-base font-black text-slate-800"
                                        required
                                    />
                                </div>

                                {/* Live Impact Preview */}
                                {amount && parseFloat(amount) > 0 && (
                                    <div className="mt-1 flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 font-medium">Estimated Remaining:</span>
                                        <span className={`font-black flex items-center gap-1 ${calculatedLiveRemaining === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                            <DirhamIcon size={12} />
                                            {calculatedLiveRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Secret Code (Collector Key) */}
                            <div className="cc-form-group">
                                <label className="text-xs font-bold text-slate-700">
                                    Collector Secret Code / PIN <span className="text-rose-500">*</span>
                                </label>
                                <div className="cc-input-wrapper">
                                    <div className="cc-field-icon">
                                        <KeyRound size={15} />
                                    </div>
                                    <input 
                                        type="password"
                                        placeholder="Enter 4-digit PIN (e.g. 1111)"
                                        value={secretCode}
                                        onChange={handleSecretCodeChange}
                                        className="cc-custom-input with-icon pr-10 font-mono text-sm"
                                        required
                                    />
                                    {isVerifyingCode && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <RefreshCw size={14} className="animate-spin text-slate-400" />
                                        </span>
                                    )}
                                    {codeVerified && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 bg-emerald-50 p-0.5 rounded">
                                            <CheckCheck size={16} />
                                        </span>
                                    )}
                                </div>

                                {/* Verified Collector Name Preview */}
                                {collectorName ? (
                                    <div className="mt-1.5 flex items-center gap-2.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
                                        <UserCheck size={16} className="text-emerald-600 shrink-0" />
                                        <div className="text-xs">
                                            <span className="font-extrabold text-emerald-900">{collectorName}</span>
                                            <span className="text-[10px] text-emerald-700 font-medium block">Authorized Collector Verified</span>
                                        </div>
                                    </div>
                                ) : secretCode && !isVerifyingCode ? (
                                    <input 
                                        type="text"
                                        placeholder="Or enter Collector / Employee Name manually"
                                        value={collectorName}
                                        onChange={(e) => setCollectorName(e.target.value)}
                                        className="mt-1.5 cc-custom-input text-xs"
                                    />
                                ) : null}
                            </div>

                            {/* Mode of Collection */}
                            <div className="cc-form-group">
                                <label className="text-xs font-bold text-slate-700">
                                    Mode of Collection
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCollectionType('Cash')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                            collectionType === 'Cash'
                                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Banknote size={14} />
                                        Cash Handover
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCollectionType('Bank Transfer')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                            collectionType === 'Bank Transfer'
                                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <Landmark size={14} />
                                        Bank Transfer
                                    </button>
                                </div>
                            </div>

                            {/* If Bank Transfer: Account & Reference */}
                            {collectionType === 'Bank Transfer' && (
                                <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                                    <div>
                                        <label className="block text-[11px] font-bold text-sky-900 mb-1">
                                            Destination Bank Account
                                        </label>
                                        <select 
                                            value={bankAccount} 
                                            onChange={(e) => setBankAccount(e.target.value)}
                                            className="cc-custom-input bg-white text-xs"
                                        >
                                            {(balanceData.bank_accounts || []).map((acc) => (
                                                <option key={acc.name} value={acc.name}>
                                                    {acc.account_name || acc.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-sky-900 mb-1">
                                            Banking Reference / Voucher No <span className="text-rose-500">*</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. UTR / Cheque / Ref #20000"
                                            value={bankingReference}
                                            onChange={(e) => setBankingReference(e.target.value)}
                                            className="cc-custom-input bg-white text-xs"
                                            required={collectionType === 'Bank Transfer'}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Remarks / Notes */}
                            <div className="cc-form-group">
                                <label className="text-xs font-bold text-slate-700">
                                    Remarks / Notes (Optional)
                                </label>
                                <input 
                                    type="text"
                                    placeholder="Add any handover notes or remarks"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="cc-custom-input text-xs"
                                />
                            </div>

                            {/* Submit Button */}
                            <button 
                                type="submit" 
                                disabled={submitting || loading}
                                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all disabled:opacity-50 mt-1"
                            >
                                {submitting ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        Recording Handover...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} />
                                        Submit Collection & Generate Slip
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* RIGHT: Collection Breakdown History Table (7 Cols) */}
                    <div className="lg:col-span-7 cc-card p-5 space-y-3.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                                    <History size={16} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black text-slate-800">
                                        Handover History ({selectedDate})
                                    </h2>
                                    <p className="text-[11px] text-slate-400 font-medium">
                                        Total {balanceData.collections?.length || 0} handover entries recorded
                                    </p>
                                </div>
                            </div>

                            {/* Search Box */}
                            <div className="relative min-w-[180px]">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input 
                                    type="text"
                                    placeholder="Filter history..."
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* Table Container */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] font-black text-slate-600 uppercase tracking-wider">
                                        <th className="py-2.5 px-3.5">Voucher / Time</th>
                                        <th className="py-2.5 px-3 text-right">Amount (AED)</th>
                                        <th className="py-2.5 px-3">Collector PIN</th>
                                        <th className="py-2.5 px-3">Employee</th>
                                        <th className="py-2.5 px-3">Mode</th>
                                        <th className="py-2.5 px-3 text-center">Slip</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {/* Initial Closing Balance Header */}
                                    <tr className="bg-slate-50/70 font-bold">
                                        <td className="py-2.5 px-3.5 text-slate-900 font-black">Initial Closing Balance</td>
                                        <td className="py-2.5 px-3 text-right font-black text-slate-900 flex items-center justify-end gap-1">
                                            <DirhamIcon size={12} />
                                            {(balanceData.closing_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-400" colSpan={4}></td>
                                    </tr>

                                    {/* Filtered Collection rows */}
                                    {filteredCollections.map((col, index) => (
                                        <tr key={col.name || index} className="hover:bg-slate-50/80 transition-all">
                                            <td className="py-3 px-3.5">
                                                <span className="font-extrabold text-slate-800 font-mono text-[11px]">{col.name}</span>
                                                <span className="block text-[10px] text-slate-400 font-normal">{col.posting_time || ''}</span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-black text-emerald-700 text-sm">
                                                <div className="flex items-center justify-end gap-1">
                                                    <DirhamIcon size={12} className="text-emerald-700" />
                                                    {parseFloat(col.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-black border border-slate-200">
                                                    {col.secret_code || '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 font-bold text-slate-800">
                                                {col.collector_name || col.employee || '-'}
                                            </td>
                                            <td className="py-3 px-3 text-[11px]">
                                                {col.collection_type === 'Bank Transfer' ? (
                                                    <div>
                                                        <span className="font-extrabold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                                            {col.banking_reference || 'Bank Ref'}
                                                        </span>
                                                        <span className="block text-[9.5px] text-slate-400 mt-0.5">{col.bank_account || ''}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                        Cash
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <button 
                                                    onClick={() => {
                                                        setPrintDoc(col);
                                                        setShowPrintModal(true);
                                                    }}
                                                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                                                    title="Reprint Thermal Slip"
                                                >
                                                    <Printer size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Final Summary Row: Remaining Balance */}
                                    <tr className="bg-emerald-50/50 font-black border-t-2 border-slate-200">
                                        <td className="py-2.5 px-3.5 text-emerald-950 uppercase tracking-wide">Live Pending Balance</td>
                                        <td className="py-2.5 px-3 text-right text-emerald-800 text-sm font-black">
                                            <div className="flex items-center justify-end gap-1">
                                                <DirhamIcon size={13} className="text-emerald-800" />
                                                {(balanceData.remaining_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-3" colSpan={4}></td>
                                    </tr>

                                    {filteredCollections.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                                                No collections recorded yet for this date.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ── 4. THERMAL PRINT SLIP MODAL (80mm PREVIEW) ── */}
                {showPrintModal && printDoc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            <div className="p-3.5 bg-slate-100 flex items-center justify-between border-b border-slate-200">
                                <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                                    <Receipt size={15} className="text-emerald-600" />
                                    Thermal Slip Preview
                                </h3>
                                <button 
                                    onClick={() => setShowPrintModal(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Printable Thermal Receipt Area */}
                            <div className="p-4 overflow-y-auto max-h-[70vh] bg-slate-50">
                                <div id="thermal-collection-slip" className="font-mono text-xs text-slate-900 space-y-2 text-center bg-white p-3.5 border border-dashed border-slate-300 rounded-xl shadow-2xs">
                                    <div className="font-black text-sm uppercase tracking-wider">{printDoc.branch || selectedBranch}</div>
                                    <div className="text-[10px] text-slate-600 font-bold uppercase">Branch Closing Amount Collection</div>
                                    <div className="text-[10px] text-slate-400">================================</div>

                                    <div className="text-left text-[11px] space-y-1.5 font-medium">
                                        <div className="flex justify-between">
                                            <span>Receipt No:</span>
                                            <span className="font-bold">{printDoc.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Date & Time:</span>
                                            <span>{printDoc.posting_date} {printDoc.posting_time || ''}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Collector Code:</span>
                                            <span className="font-bold">{printDoc.secret_code || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Collector Name:</span>
                                            <span className="font-bold">{printDoc.collector_name || printDoc.employee || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Payment Mode:</span>
                                            <span className="font-bold">{printDoc.collection_type || 'Cash'}</span>
                                        </div>
                                        {printDoc.banking_reference && (
                                            <div className="flex justify-between">
                                                <span>Bank Ref:</span>
                                                <span className="font-bold">{printDoc.banking_reference}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-[10px] text-slate-400">--------------------------------</div>

                                    <div className="text-left text-[11px] space-y-1.5">
                                        <div className="flex justify-between font-medium">
                                            <span>Closing Balance:</span>
                                            <span>AED {parseFloat(printDoc.closing_balance || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-black text-sm text-slate-900">
                                            <span>COLLECTED AMOUNT:</span>
                                            <span>AED {parseFloat(printDoc.amount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-emerald-800">
                                            <span>REMAINING BALANCE:</span>
                                            <span>AED {parseFloat(printDoc.remaining_balance || 0).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="text-[10px] text-slate-400">================================</div>

                                    <div className="pt-5 grid grid-cols-2 text-[9px] text-center gap-4">
                                        <div>
                                            <div className="border-b border-slate-400 pb-1"></div>
                                            <span className="mt-1 block font-bold text-slate-700">Branch Manager</span>
                                        </div>
                                        <div>
                                            <div className="border-b border-slate-400 pb-1"></div>
                                            <span className="mt-1 block font-bold text-slate-700">Collector Signature</span>
                                        </div>
                                    </div>

                                    <div className="text-[8px] text-slate-400 pt-2.5">
                                        Generated automatically via Retail-POS
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex gap-2">
                                <button 
                                    onClick={handlePrintThermal}
                                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                >
                                    <Printer size={15} />
                                    Print Thermal Slip
                                </button>
                                <button 
                                    onClick={() => setShowPrintModal(false)}
                                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ClosingCollection;
