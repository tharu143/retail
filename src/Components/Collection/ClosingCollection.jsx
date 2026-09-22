import PageHeader from '../UI/PageHeader';
import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { 
    Wallet, Building2, Calendar, KeyRound, UserCheck, CreditCard, 
    Landmark, FileText, CheckCircle2, AlertCircle, Printer, RefreshCw, 
    History, ArrowRight, ShieldCheck, DollarSign, X, Check, Search, Receipt,
    Coins, Banknote, ArrowDownToLine, CheckCheck, Landmark as BankIcon
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

    // 4. Submit Collection Flow with PIN Modal
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

        // Interactive Live-Resolving SweetAlert2 Collector PIN Modal
        let resolvedCollectorData = null;
        let verifiedCode = '';

        const { value: confirmed } = await Swal.fire({
            title: '🔑 Collector Secret PIN Verification',
            html: `
                <div style="text-align: left; font-size: 13px; color: #475569; margin-bottom: 14px; line-height: 1.5;">
                    <div><strong>Branch:</strong> ${selectedBranch}</div>
                    <div><strong>Handover Amount:</strong> <span style="color: #059669; font-weight: 800; font-size: 14px;">AED ${enteredAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
                <div style="text-align: left; margin-bottom: 8px;">
                    <label style="font-size: 12px; font-weight: 700; color: #334155; display: block; margin-bottom: 6px;">
                        Enter 4-Digit Secret PIN:
                    </label>
                    <input 
                        id="swal-collector-pin-input" 
                        type="password" 
                        maxlength="10" 
                        placeholder="••••"
                        style="width: 100%; height: 44px; text-align: center; font-size: 24px; letter-spacing: 6px; font-weight: 800; border: 2px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; outline: none;" 
                        autofocus
                    />
                </div>
                <div id="swal-collector-status-box" style="min-height: 52px; margin-top: 10px; display: flex; align-items: center; justify-content: center;">
                    <div style="font-size: 12px; color: #94a3b8; font-style: italic;">
                        Type PIN to verify collector...
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '✓ Confirm & Submit Handover',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#059669',
            cancelButtonColor: '#94a3b8',
            didOpen: () => {
                const inputEl = document.getElementById('swal-collector-pin-input');
                const statusBox = document.getElementById('swal-collector-status-box');
                const confirmBtn = Swal.getConfirmButton();
                if (confirmBtn) confirmBtn.disabled = true;

                let timeout = null;
                inputEl?.addEventListener('input', (e) => {
                    const val = e.target.value.trim();
                    resolvedCollectorData = null;
                    verifiedCode = '';
                    if (confirmBtn) confirmBtn.disabled = true;

                    if (val.length < 3) {
                        statusBox.innerHTML = `<div style="font-size: 12px; color: #94a3b8; font-style: italic;">Type PIN to verify collector...</div>`;
                        return;
                    }

                    statusBox.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b;">
                            <span class="animate-spin" style="display: inline-block;">⟳</span> Verifying PIN...
                        </div>
                    `;

                    clearTimeout(timeout);
                    timeout = setTimeout(async () => {
                        try {
                            const res = await fetch(`${API_PATH}.get_collector_by_secret_code?secret_code=${encodeURIComponent(val)}`, {
                                headers: { 'X-Frappe-SID': getSession() },
                                credentials: 'include'
                            });
                            const json = await res.json();
                            const result = json.message || json;
                            if (result.status === 'success' && result.data) {
                                resolvedCollectorData = result.data;
                                verifiedCode = val;
                                if (confirmBtn) confirmBtn.disabled = false;
                                statusBox.innerHTML = `
                                    <div style="width: 100%; display: flex; align-items: center; gap: 10px; background: #ecfdf5; border: 1.5px solid #a7f3d0; padding: 8px 12px; border-radius: 8px; text-align: left;">
                                        <div style="width: 28px; height: 28px; border-radius: 50%; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px;">✓</div>
                                        <div>
                                            <div style="font-size: 13px; font-weight: 800; color: #065f46;">${result.data.collector_name}</div>
                                            <div style="font-size: 11px; color: #047857;">Authorized Collector (${result.data.employee || 'Active'})</div>
                                        </div>
                                    </div>
                                `;
                            } else {
                                if (confirmBtn) confirmBtn.disabled = true;
                                statusBox.innerHTML = `
                                    <div style="font-size: 12px; color: #ef4444; font-weight: 700; background: #fef2f2; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 6px;">
                                        ✕ Invalid PIN — Collector not recognized
                                    </div>
                                `;
                            }
                        } catch (err) {
                            if (confirmBtn) confirmBtn.disabled = true;
                            statusBox.innerHTML = `<div style="font-size: 12px; color: #ef4444;">Verification error: ${err.message}</div>`;
                        }
                    }, 250);
                });
            },
            preConfirm: () => {
                if (!resolvedCollectorData || !verifiedCode) {
                    Swal.showValidationMessage('Please enter a valid Collector PIN to verify');
                    return false;
                }
                return { pin: verifiedCode, collectorData: resolvedCollectorData };
            }
        });

        if (!confirmed || !confirmed.pin || !confirmed.collectorData) return;

        const verifiedCollector = confirmed.collectorData.collector_name;
        const verifiedPin = confirmed.pin;

        setSubmitting(true);
        try {
            const payload = {
                branch: selectedBranch,
                posting_date: selectedDate,
                amount: enteredAmt,
                collection_type: 'Cash',
                secret_code: verifiedPin,
                collector_name: verifiedCollector,
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
                    title: 'Collection Recorded!',
                    html: `<div style="font-size: 14px; color: #334155;">Cash handover to <strong>${verifiedCollector}</strong> recorded successfully.</div>`,
                    timer: 2500,
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
        <div className="erp-collection-page bca-page-wrapper">
            <div className="bca-container">
                
                {/* ── 1. CLEAN TOP HEADER BANNER ── */}
                <PageHeader className="bca-header-card">
                    <div className="bca-header-left">
                        <div className="bca-header-icon-box">
                            <Wallet size={24} />
                        </div>
                        <div>
                            <h1 className="bca-header-title">
                                Cash Collection
                            </h1>
                            <p className="bca-header-subtitle">
                                Track total counter cash (Opening Float + Cash Sales), verify handovers with PIN & generate thermal slips
                            </p>
                        </div>
                    </div>

                    {/* Header Controls */}
                    <div className="bca-header-controls">
                        {isAdmin && (
                            <div className="bca-control-pill">
                                <Building2 size={15} className="text-slate-400" />
                                <select 
                                    value={selectedBranch} 
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="bca-control-select"
                                >
                                    {branches.map((b) => (
                                         <option key={b.name} value={b.name}>
                                             {b.warehouse_name || b.name}
                                         </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="bca-control-pill">
                            <Calendar size={15} className="text-slate-400" />
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bca-control-date"
                            />
                        </div>

                        <button 
                            onClick={fetchCollectionData} 
                            disabled={loading}
                            className="bca-refresh-btn"
                            title="Refresh Data"
                        >
                            <RefreshCw size={15} className={loading ? "animate-spin text-emerald-600" : ""} />
                        </button>
                    </div>
                </PageHeader>

                {/* ── 2. 3 ELEVATED KPI METRIC CARDS ── */}
                <div className="bca-kpi-grid">
                    {/* Total Cash Balance */}
                    <div className="erp-metric bca-kpi-card blue">
                        <div className="bca-kpi-top">
                            <span className="bca-kpi-label">Total Cash Collection</span>
                            <div className="bca-kpi-badge-icon">
                                <Coins size={16} />
                            </div>
                        </div>
                        <div className="bca-kpi-value-row">
                            <DirhamIcon size={20} className="text-slate-700" />
                            <span className="bca-kpi-value">
                                {(balanceData.closing_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bca-kpi-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10.5 }}>
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                                Opening: AED {(balanceData.opening_cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                                Sales: AED {(balanceData.sales_cash || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Total Collected Today */}
                    <div className="erp-metric bca-kpi-card amber">
                        <div className="bca-kpi-top">
                            <span className="bca-kpi-label">Total Collected Today</span>
                            <div className="bca-kpi-badge-icon">
                                <History size={16} />
                            </div>
                        </div>
                        <div className="bca-kpi-value-row">
                            <DirhamIcon size={20} className="text-amber-600" />
                            <span className="bca-kpi-value">
                                {(balanceData.total_collected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bca-kpi-footer">
                            <span>{balanceData.collections?.length || 0} handover entry(s) recorded</span>
                        </div>
                    </div>

                    {/* Remaining to Collect */}
                    <div className="erp-metric bca-kpi-card emerald">
                        <div className="bca-kpi-top">
                            <span className="bca-kpi-label">Remaining to Collect</span>
                            <div className="bca-kpi-badge-icon">
                                <CheckCircle2 size={16} />
                            </div>
                        </div>
                        <div className="bca-kpi-value-row">
                            <DirhamIcon size={20} className="text-emerald-700" />
                            <span className="bca-kpi-value">
                                {(balanceData.remaining_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bca-kpi-footer">
                            <span>Pending at branch counter</span>
                            {balanceData.remaining_balance > 0 && (
                                <button
                                    onClick={handleFillMaxAmount}
                                    className="bca-kpi-quick-btn"
                                >
                                    Quick Fill
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── 3. WORKSPACE GRID: FORM & HISTORY TABLE ── */}
                <div className="bca-workspace-grid">
                    
                    {/* LEFT PANEL: Record Handover Form */}
                    <div className="erp-card bca-panel">
                        <div className="erp-section-header bca-panel-header">
                            <div className="bca-panel-title-wrap">
                                <div className="bca-panel-icon">
                                    <ArrowDownToLine size={17} />
                                </div>
                                <h2 className="bca-panel-title">
                                    Record New Collection
                                </h2>
                            </div>
                            <span className="bca-branch-tag" title={selectedBranch}>
                                {selectedBranch || 'Branch'}
                            </span>
                        </div>

                        <form onSubmit={handleSubmit} className="bca-form">
                            {/* Amount Field */}
                            <div className="bca-field-group">
                                <div className="bca-field-label-row">
                                    <label className="bca-field-label">
                                        Collection Amount (AED) <span className="bca-field-req">*</span>
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={handleFillMaxAmount}
                                        className="bca-field-fill-max"
                                    >
                                        Fill Max ({(balanceData.remaining_balance || 0).toLocaleString()})
                                    </button>
                                </div>
                                <div className="bca-input-container">
                                    <div className="bca-input-prefix-icon">
                                        <DirhamIcon size={16} />
                                    </div>
                                    <input 
                                        type="number"
                                        step="any"
                                        min="0.01"
                                        placeholder="0.00"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="bca-input bca-input-amount"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Collector PIN Verification Info */}
                            <div className="bca-field-group">
                                <label className="bca-field-label">
                                    Collector Authorization <span className="bca-field-req">*</span>
                                </label>
                                <div style={{
                                    padding: '12px 14px',
                                    borderRadius: 10,
                                    border: '1.5px dashed #cbd5e1',
                                    background: '#f8fafc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10
                                }}>
                                    <KeyRound size={20} style={{ color: '#059669' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Collector Secret PIN Prompt</div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>A secure PIN verification popup will appear when clicking <b>Submit Handover</b>.</div>
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 6 }}>
                                        MANDATORY
                                    </span>
                                </div>
                            </div>

                            {/* Mode of Collection - Cash Only */}
                            <div className="bca-field-group">
                                <label className="bca-field-label">
                                    Mode of Collection
                                </label>
                                <div className="bca-mode-selector">
                                    <div className="bca-mode-tab active" style={{ cursor: 'default' }}>
                                        <Banknote size={15} />
                                        <span>Cash Handover</span>
                                    </div>
                                </div>
                            </div>

                            {/* Remarks */}
                            <div className="bca-field-group">
                                <label className="bca-field-label">
                                    Remarks / Notes (Optional)
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Add any handover notes"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="bca-input"
                                    style={{ height: 40, fontSize: 13, paddingLeft: 14 }}
                                />
                            </div>

                            {/* Submit Button */}
                            <button 
                                type="submit" 
                                disabled={submitting || loading}
                                className="bca-submit-btn"
                            >
                                {submitting ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        <span>Recording Handover...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={17} />
                                        <span>Submit Collection & Print Slip</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* RIGHT PANEL: Handover History ERP Table */}
                    <div className="erp-card bca-panel">
                        <div className="erp-section-header bca-panel-header">
                            <div className="bca-panel-title-wrap">
                                <div className="bca-panel-icon" style={{ background: '#f1f5f9', color: '#475569' }}>
                                    <History size={17} />
                                </div>
                                <div>
                                    <h2 className="bca-panel-title">
                                        Handover History ({selectedDate})
                                    </h2>
                                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                        {balanceData.collections?.length || 0} entries recorded
                                    </div>
                                </div>
                            </div>

                            {/* Search Filter */}
                            <div className="bca-table-search-box">
                                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                                <input 
                                    type="text"
                                    placeholder="Filter entries..."
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    className="bca-table-search-input"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="erp-table-scroll bca-table-wrapper">
                            <table className="erp-table bca-table">
                                <thead>
                                    <tr>
                                        <th>VOUCHER / TIME</th>
                                        <th className="text-right">AMOUNT (AED)</th>
                                        <th>COLLECTOR / EMPLOYEE</th>
                                        <th>REMARKS</th>
                                        <th className="text-center">SLIP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Row 1: Total Cash to Collect */}
                                    <tr className="bca-row-summary">
                                        <td style={{ color: '#0f172a' }}>Total Cash to Collect</td>
                                        <td className="text-right" style={{ color: '#0f172a' }}>
                                            {(balanceData.closing_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ color: '#94a3b8' }}>—</td>
                                        <td style={{ color: '#94a3b8' }}>—</td>
                                        <td className="text-center" style={{ color: '#94a3b8' }}>—</td>
                                    </tr>

                                    {/* History Rows */}
                                    {filteredCollections.map((col, index) => (
                                        <tr key={col.name || index}>
                                            <td>
                                                <div style={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{col.name}</div>
                                                <div style={{ fontSize: 10, color: '#64748b' }}>{col.posting_time || ''}</div>
                                            </td>
                                            <td className="text-right" style={{ fontWeight: 800, color: '#047857', fontSize: 13 }}>
                                                {parseFloat(col.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ fontWeight: 700, color: '#1e293b' }}>
                                                {col.collector_name || col.employee || '-'}
                                            </td>
                                            <td style={{ fontSize: 11, color: '#64748b' }}>
                                                {col.description || 'Cash Handover'}
                                            </td>
                                            <td className="text-center">
                                                <button 
                                                    onClick={() => {
                                                        setPrintDoc(col);
                                                        setShowPrintModal(true);
                                                    }}
                                                    className="bca-print-icon-btn"
                                                    title="Reprint Slip"
                                                >
                                                    <Printer size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Final Row: Live Remaining Balance */}
                                    <tr className="bca-row-live">
                                        <td style={{ textTransform: 'uppercase' }}>Live Pending Balance</td>
                                        <td className="text-right" style={{ fontSize: 14 }}>
                                            {(balanceData.remaining_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td colSpan={3}></td>
                                    </tr>

                                    {filteredCollections.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontWeight: 600 }}>
                                                No collection handovers recorded yet for this date.
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
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                        <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', width: '100%', maxWidth: 380, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
                            <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1e293b' }}>
                                    <Receipt size={16} style={{ color: '#059669' }} />
                                    <span>Thermal Slip Preview</span>
                                </div>
                                <button 
                                    onClick={() => setShowPrintModal(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 4 }}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Printable Thermal Receipt Area */}
                            <div style={{ padding: 16, background: '#f1f5f9', maxHeight: '70vh', overflowY: 'auto' }}>
                                <div id="thermal-collection-slip" style={{ fontFamily: 'monospace', fontSize: 11, color: '#000000', lineHeight: 1.3, background: '#ffffff', padding: 14, border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                                    <div style={{ fontWeight: 900, fontSize: 13, textTransform: 'uppercase', textAlign: 'center' }}>{printDoc.branch || selectedBranch}</div>
                                    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', color: '#475569', marginTop: 2 }}>Cash Collection Handover</div>
                                    <div style={{ textAlign: 'center', margin: '6px 0', fontSize: 10 }}>================================</div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10.5 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Receipt No:</span>
                                            <span style={{ fontWeight: 800 }}>{printDoc.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Date & Time:</span>
                                            <span>{printDoc.posting_date} {printDoc.posting_time || ''}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Employee / Collector:</span>
                                            <span style={{ fontWeight: 800 }}>{printDoc.collector_name || printDoc.employee || '-'}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Payment Mode:</span>
                                            <span style={{ fontWeight: 800 }}>{printDoc.collection_type || 'Cash'}</span>
                                        </div>
                                        {printDoc.banking_reference && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Bank Ref:</span>
                                                <span style={{ fontWeight: 800 }}>{printDoc.banking_reference}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ textAlign: 'center', margin: '6px 0', fontSize: 10 }}>--------------------------------</div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Closing Balance:</span>
                                            <span>AED {parseFloat(printDoc.closing_balance || 0).toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 12 }}>
                                            <span>COLLECTED AMOUNT:</span>
                                            <span>AED {parseFloat(printDoc.amount || 0).toFixed(2)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#047857' }}>
                                            <span>REMAINING BALANCE:</span>
                                            <span>AED {parseFloat(printDoc.remaining_balance || 0).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center', margin: '6px 0', fontSize: 10 }}>================================</div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24, textAlign: 'center', fontSize: 9 }}>
                                        <div>
                                            <div style={{ borderBottom: '1px solid #000000', marginBottom: 4 }}></div>
                                            <span style={{ fontWeight: 700 }}>Branch Manager</span>
                                        </div>
                                        <div>
                                            <div style={{ borderBottom: '1px solid #000000', marginBottom: 4 }}></div>
                                            <span style={{ fontWeight: 700 }}>Collector Signature</span>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: 8, color: '#64748b', textAlign: 'center', marginTop: 12 }}>
                                        Generated automatically via Retail-POS
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div style={{ padding: 12, background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
                                <button 
                                    onClick={handlePrintThermal}
                                    style={{ flex: 1, height: 38, background: '#059669', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}
                                >
                                    <Printer size={15} />
                                    <span>Print Thermal Slip</span>
                                </button>
                                <button 
                                    onClick={() => setShowPrintModal(false)}
                                    style={{ height: 38, padding: '0 16px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
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
