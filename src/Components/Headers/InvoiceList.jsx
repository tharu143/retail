import { useEffect, useState, useMemo } from "react";
import {
    AlertCircle, Search, Calendar, Clock, CreditCard,
    CheckCircle, Cloud, RefreshCw, XCircle, FileText, Plus,
    Printer, Eye, Filter, Trash2, ArrowLeft, Smartphone, Palette, Loader2, Link
} from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { db } from '../../db';
import "../Admin/SalesOrder.css";
import { useLegacyTheme } from "../../hooks/useLegacyTheme";
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import AttachmentSection from "../Admin/AttachmentSection";


const formatDateToDMY = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
};

function InvoiceList() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filter State
    const [filterId, setFilterId] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [filterTime, setFilterTime] = useState("");
    const [filterMobile, setFilterMobile] = useState("");
    const [filterMode, setFilterMode] = useState("");
    const [filterSource, setFilterSource] = useState(""); // 'all', 'synced', 'pending'

    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [offlineInvoices, setOfflineInvoices] = useState([]);

    // Suggestions
    const [showIdSuggestions, setShowIdSuggestions] = useState(false);
    const idSuggestions = useMemo(() => {
        if (!filterId || filterId.length < 2) return [];
        const unique = new Set();
        const allNames = [...offlineInvoices.map(i => i.name), ...invoices.map(i => i.name)];
        const allOffIds = [...offlineInvoices.map(i => i.offline_id), ...invoices.map(i => i.offline_id)].filter(Boolean);

        return [...allNames, ...allOffIds]
            .filter(id => id.toLowerCase().includes(filterId.toLowerCase()))
            .filter(id => {
                const lower = id.toLowerCase();
                if (unique.has(lower)) return false;
                unique.add(lower);
                return true;
            }).slice(0, 8);
    }, [filterId, offlineInvoices, invoices]);

    const userData = useSelector((state) => state.user);
    const getSession = () => userData?.session || localStorage.getItem("session") || "";

    // Sync Theme (Using the same hook as POS)
    const { legacySubTheme, isGreen, toggleTheme: toggleLegacyColor } = useLegacyTheme();
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';

    // Load local and server data
    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Load Local Dexie Invoices
            const local = await db.invoices.toArray();
            const mappedLocal = local.map(inv => ({
                ...inv,
                name: inv.server_name || inv.offline_id || `LOCAL-${inv.id}`,
                customer_name: inv.customer || 'Cash',
                grand_total: inv.grand_total || 0,
                posting_date: inv.posting_date || '',
                posting_time: inv.posting_time || '',
                _source: (() => {
                    if (!inv.is_synced) return 'pending';
                    const hasValidERPName = inv.server_name && /^[A-Za-z0-9]{2,}-/.test(inv.server_name);
                    return hasValidERPName ? 'synced_local' : 'sync_failed';
                })(),
                _synced_at: inv.synced_at || null,
            }));
            setOfflineInvoices(mappedLocal);

            // 2. Load Server Invoices if Online
            if (navigator.onLine) {
                const session = getSession();
                const response = await fetch(
                    "/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_invoices?limit=2000&limit_page_length=2000",
                    {
                        method: "GET",
                        headers: { "X-Frappe-SID": session },
                        credentials: "include",
                    }
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.message?.status === "success" && Array.isArray(data.message?.data)) {
                        setInvoices(data.message.data.map(raw => ({
                            ...raw,
                            _source: 'server',
                            customer_name: raw.customer_name || raw.customer || "N/A",
                        })));
                    }
                }
            }
        } catch (err) {
            console.error("Data load failed:", err);
            setError("Synchronization issue. Local data available.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Filter Logic
    const filteredInvoices = useMemo(() => {
        const serverNames = new Set(invoices.map(inv => inv.name));
        const pendingOffline = offlineInvoices.filter(
            inv => inv._source === 'pending' && !serverNames.has(inv.name)
        );
        const merged = [...pendingOffline, ...invoices];

        return merged.filter(inv => {
            const idLower = (inv.name || "").toLowerCase();
            const offIdLower = (inv.offline_id || "").toLowerCase();
            const searchLower = filterId.toLowerCase();

            const matchId = idLower.includes(searchLower) || offIdLower.includes(searchLower);
            const matchDate = filterDate ? (inv.posting_date === filterDate) : true;
            const matchTime = filterTime ? (inv.posting_time?.startsWith(filterTime)) : true;
            const matchMobile = filterMobile ? (inv.contact_mobile || "").includes(filterMobile) : true;

            const pModes = (inv.payments || []).map(p => p.mode_of_payment || "").join(",").toLowerCase();
            const matchMode = filterMode ? pModes.includes(filterMode.toLowerCase()) : true;

            let matchSource = true;
            if (filterSource === 'pending') matchSource = inv._source === 'pending';
            else if (filterSource === 'synced') matchSource = inv._source === 'server' || inv._source === 'synced_local';

            return matchId && matchDate && matchTime && matchMobile && matchMode && matchSource;
        });
    }, [invoices, offlineInvoices, filterId, filterDate, filterTime, filterMobile, filterMode, filterSource]);

    const clearFilters = () => {
        setFilterId(""); setFilterDate(""); setFilterTime("");
        setFilterMobile(""); setFilterMode(""); setFilterSource("");
    };

    const StatusBadge = ({ inv }) => {
        if (inv._source === 'pending') {
            return <span className="so-badge" style={{ background: '#fef3c7', color: '#92400e' }}><RefreshCw size={11} className="animate-spin" /> PENDING</span>;
        }
        if (inv._source === 'sync_failed') {
            return <span className="so-badge" style={{ background: '#fee2e2', color: '#991b1b' }}><XCircle size={11} /> FAILED</span>;
        }
        if (inv._source === 'synced_local') {
            return <span className="so-badge" style={{ background: '#dcfce7', color: '#166534' }}><CheckCircle size={11} /> SYNCED</span>;
        }
        return <span className="so-badge" style={{ background: 'var(--so-primary-light)', color: 'var(--so-primary)' }}><Cloud size={11} /> SERVER</span>;
    };

    const handlePrint = (invoice) => {
        const cashier = invoice.owner || userData?.user?.split('@')[0].toUpperCase() || 'CASHIER';
        const companyName = userData?.company || 'RETAIL POS';
        const address = userData?.warehouse || 'Main Store';
        
        const items = invoice.items || [];
        const payments = invoice.payments || [];
        const taxes = invoice.taxes || [];
        const subtotal = items.reduce((sum, it) => sum + (it.amount || 0), 0);
        
        const barCodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoice.name}&scale=2&height=10`;
        const dirhamSvgHtml = `<svg viewBox="0 0 344.84 299.91" style="width: 12px; height: 10px; display: inline-block; vertical-align: middle; fill: currentColor; margin-right: 2px;"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Bill Print - ${invoice.name}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { width: 72mm; margin: 0 auto; padding: 10px 0; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.2; color: #000; }
                        .center { text-align: center; }
                        .right { text-align: right; }
                        .bold { font-weight: bold; }
                        .divider { border-top: 1px dashed #000; margin: 6px 0; }
                        .header h2 { margin: 0; font-size: 16px; text-transform: uppercase; }
                        .header p { margin: 2px 0; font-size: 10px; }
                        .info-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 2px; }
                        .items-table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
                        .items-table th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; }
                        .items-table td { padding: 3px 0; vertical-align: top; }
                        .total-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 11px; }
                        .grand-total { font-size: 14px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
                        .tax-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 5px; }
                        .tax-table td { padding: 1px 0; }
                        .barcode { display: block; margin: 10px auto; width: 80%; height: 35px; }
                        .loyalty-box { border: 1px solid #000; padding: 4px; margin-top: 5px; font-size: 9px; }
                        @media print { body { width: 72mm; margin: 0 auto; } }
                    </style>
                </head>
                <body>
                    <div class="header center">
                        <h2 class="bold">${companyName}</h2>
                        <p>${address}</p>
                    </div>
                    <div class="divider"></div>
                    <div class="info">
                        <div class="info-row"><span>CASHIER:</span> <span class="bold">${cashier}</span></div>
                        <div class="info-row"><span>DATE/TIME:</span> <span>${formatDateToDMY(invoice.posting_date)} ${invoice.posting_time?.split('.')[0] || ''}</span></div>
                        <div class="info-row"><span>INV NO:</span> <span class="bold">${invoice.name}</span></div>
                        ${invoice.offline_id ? `<div class="info-row"><span>OFFLINE ID:</span> <span>${invoice.offline_id}</span></div>` : ''}
                        <div class="info-row"><span>CUSTOMER:</span> <span>${invoice.customer_name}</span></div>
                    </div>
                    <div class="divider"></div>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 50%;">ITEM</th>
                                <th class="right">QTY</th>
                                <th class="right">PRICE</th>
                                <th class="right">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(it => `
                                <tr>
                                    <td>${it.item_name || it.item_code}</td>
                                    <td class="right">${it.qty}</td>
                                    <td class="right">${parseFloat(it.rate || 0).toFixed(2)}</td>
                                    <td class="right">${parseFloat(it.amount || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="divider"></div>
                    <div class="totals">
                        <div class="total-row"><span>NET TOTAL:</span><span>${parseFloat(subtotal).toFixed(2)}</span></div>
                        ${invoice.total_taxes_and_charges > 0 ? `<div class="total-row"><span>VAT/TAX:</span><span>${parseFloat(invoice.total_taxes_and_charges).toFixed(2)}</span></div>` : ''}
                        ${invoice.discount_amount > 0 ? `<div class="total-row"><span>DISCOUNT:</span><span>-${parseFloat(invoice.discount_amount).toFixed(2)}</span></div>` : ''}
                        <div class="total-row bold grand-total"><span>GRAND TOTAL:</span><span>${dirhamSvgHtml}${parseFloat(invoice.grand_total).toFixed(2)}</span></div>
                    </div>
                    
                    <div class="divider"></div>
                    <div class="payments">
                        <span class="bold" style="font-size: 10px;">PAYMENTS:</span>
                        ${payments.map(p => `
                            <div class="info-row"><span>${p.mode_of_payment}:</span><span>${parseFloat(p.amount).toFixed(2)}</span></div>
                        `).join('')}
                    </div>

                    ${taxes.length > 0 ? `
                        <div class="divider"></div>
                        <span class="bold" style="font-size: 9px;">TAX BREAKDOWN:</span>
                        <table class="tax-table">
                            ${taxes.map(t => `
                                <tr><td>${t.description}</td><td class="right">${parseFloat(t.tax_amount).toFixed(2)}</td></tr>
                            `).join('')}
                        </table>
                    ` : ''}

                    ${invoice.loyalty_points > 0 || invoice.redeem_loyalty_points > 0 ? `
                        <div class="loyalty-box center">
                            <div class="bold">LOYALTY PROGRAM</div>
                            <div class="info-row"><span>Points Earned:</span><span>${invoice.loyalty_points || 0}</span></div>
                            <div class="info-row"><span>Points Redeemed:</span><span>${invoice.redeem_loyalty_points || 0}</span></div>
                        </div>
                    ` : ''}

                    <div class="divider"></div>
                    <div class="center" style="font-size: 10px; margin-top: 10px;">
                        <p class="bold">THANK YOU FOR YOUR BUSINESS!</p>
                        <img class="barcode" src="${barCodeUrl}" />
                        <p style="font-size: 8px;">${invoice.name}</p>
                    </div>
                    <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="so-page">
            <div className="so-page-header">
                <div>
                    <h1 className="so-page-title"><FileText size={20} /> POS Invoice Journal</h1>
                    <p className="so-page-subtitle">{filteredInvoices.length} transaction(s) available</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={toggleLegacyColor}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem', background: '#f8fafc',
                            border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                            fontSize: '0.75rem', fontWeight: 850, color: themeColor,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}
                    >
                        <Palette size={13} />
                        {isGreen ? 'BLUE' : 'GREEN'}
                    </button>
                    <button 
                        className="so-btn-primary" 
                        onClick={() => navigate('/homepage')}
                        style={{ border: 'none' }}
                    >
                        <Plus size={16} /> Create Invoice
                    </button>
                    <button className="so-btn-secondary" onClick={loadData} disabled={loading} style={{ border: 'none', background: '#f1f5f9', color: '#475569' }}>
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Sync Store
                    </button>
                </div>
            </div>

            <div className="so-layout">
                <div className="so-filter-bar" style={{ background: 'white' }}>
                    <div style={{ flex: '1 1 200px', position: 'relative' }}>
                        <label className="so-filter-label">Search ID</label>
                        <input
                            type="text"
                            className="so-filter-input"
                            placeholder="Invoice # or Ref..."
                            value={filterId}
                            onChange={(e) => { setFilterId(e.target.value); setShowIdSuggestions(true); }}
                            onFocus={() => setShowIdSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowIdSuggestions(false), 200)}
                        />
                        {showIdSuggestions && idSuggestions.length > 0 && (
                            <div className="so-dropdown-portal" style={{ top: 'unset', bottom: '100%', marginBottom: '8px' }}>
                                {idSuggestions.map((id, i) => (
                                    <div
                                        key={i}
                                        className="so-dropdown-item"
                                        onClick={() => { setFilterId(id); setShowIdSuggestions(false); }}
                                    >
                                        {id}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ flex: '1 1 150px' }}>
                        <label className="so-filter-label">Date</label>
                        <input
                            type="date"
                            className="so-filter-input"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                            onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                        />
                    </div>

                    <div style={{ flex: '1 1 150px' }}>
                        <label className="so-filter-label">Payment Mode</label>
                        <select className="so-filter-select" value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
                            <option value="">All Modes</option>
                            <option value="Cash">Cash</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Bank">Bank</option>
                        </select>
                    </div>

                    <div style={{ flex: '1 1 150px' }}>
                        <label className="so-filter-label">Sync Status</label>
                        <select className="so-filter-select" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
                            <option value="">All Sources</option>
                            <option value="synced">Synced (Live)</option>
                            <option value="pending">Pending Sync</option>
                        </select>
                    </div>

                    <button className="so-clear-btn" onClick={clearFilters} style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1rem' }}>
                        Clear
                    </button>
                </div>

                <div className="so-content">
                    <div className="so-table-card">
                        <div className="so-table-wrapper" style={{ overflowX: 'auto' }}>
                            <table className="so-table">
                                <thead>
                                    <tr>
                                        <th>Invoice Reference</th>
                                        <th>Posting Details</th>
                                        <th>Customer</th>
                                        <th style={{ textAlign: 'right' }}>Grand Total</th>
                                        <th style={{ textAlign: 'center' }}>Status</th>
                                        <th style={{ textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="so-empty">
                                                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                                                <p style={{ marginTop: '0.5rem' }}>Synchronizing journals...</p>
                                            </td>
                                        </tr>
                                    ) : filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="so-empty">No invoices found for the selected criteria.</td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map((inv, idx) => (
                                            <tr key={inv.name + idx} onClick={() => setSelectedInvoice(inv)}>
                                                <td>
                                                    <div style={{ fontWeight: 800, color: themeColor }}>{inv.name}</div>
                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                                                        REF: {inv.offline_id || 'SERVER-ONLY'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                                                        <Calendar size={12} style={{ color: '#64748b' }} /> {formatDateToDMY(inv.posting_date)}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.7rem', marginTop: '4px' }}>
                                                        <Clock size={12} /> {inv.posting_time || '--:--'}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{inv.customer_name}</td>
                                                <td style={{ fontWeight: 800, textAlign: 'right', fontSize: '0.9rem' }}>
                                                    <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} /> {parseFloat(inv.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}><StatusBadge inv={inv} /></td>
                                                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                        <button className="so-btn-ghost" onClick={() => setSelectedInvoice(inv)} title="View Detail">
                                                            <Eye size={16} />
                                                        </button>
                                                        <button className="so-btn-ghost" onClick={() => handlePrint(inv)} title="Quick Print">
                                                            <Printer size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {selectedInvoice && (
                <div 
                    className="fixed inset-0 z-[2000] bg-white flex flex-col animate-fadeIn"
                    style={{ maxHeight: '100vh' }}
                >
                    {/* FULL SCREEN HEADER */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setSelectedInvoice(null)}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                    <FileText size={20} className="text-slate-400" />
                                    {selectedInvoice.name}
                                </h1>
                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                    {selectedInvoice.offline_id ? `LOCAL REF: ${selectedInvoice.offline_id}` : 'SERVER TRANSACTION'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                className="px-6 h-11 bg-slate-900 text-white rounded-xl font-black text-[13px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-slate-900/20 active:scale-95 transition-all"
                                onClick={() => handlePrint(selectedInvoice)}
                            >
                                <Printer size={18} /> Print Invoice
                            </button>
                            <button 
                                onClick={() => setSelectedInvoice(null)}
                                className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-50 text-rose-500 border border-slate-200 hover:bg-rose-50"
                            >
                                <XCircle size={22} />
                            </button>
                        </div>
                    </div>

                    {/* FULL SCREEN BODY */}
                    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Attachment Section at the top */}
                            <div className="lg:col-span-3">
                                <AttachmentSection 
                                    doctype="Sales Invoice" 
                                    docname={(selectedInvoice._source === 'server' || selectedInvoice._source === 'synced_local') ? selectedInvoice.name : null} 
                                />
                            </div>
                            
                            {/* LEFT: SUMMARY CARDS */}
                            <div className="lg:col-span-1 flex flex-col gap-4">
                                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Transaction Details</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[11px] font-black text-slate-400 uppercase italic">Customer</span>
                                            <span className="text-sm font-black text-slate-800 text-right">{selectedInvoice.customer_name}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[11px] font-black text-slate-400 uppercase italic">Date & Time</span>
                                            <span className="text-sm font-black text-slate-800">{formatDateToDMY(selectedInvoice.posting_date)} · {selectedInvoice.posting_time?.split('.')[0] || '00:00'}</span>
                                        </div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-[11px] font-black text-slate-400 uppercase italic">Offline Ref</span>
                                            <span className="text-sm font-black text-slate-500 uppercase">{selectedInvoice.offline_id || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between items-start">
                                            <span className="text-[11px] font-black text-slate-400 uppercase italic">Cashier</span>
                                            <span className="text-xs font-black text-slate-500">{selectedInvoice.owner}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Payment Summary</h4>
                                        <div className="space-y-3">
                                            {(selectedInvoice.payments || []).map((p, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
                                                    <span className="text-[11px] font-bold text-slate-600 uppercase">{p.mode_of_payment}</span>
                                                    <span className="text-sm font-black text-slate-900 flex items-center gap-1"><DirhamIcon size={12} /> {parseFloat(p.amount).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {(selectedInvoice.loyalty_points > 0 || selectedInvoice.redeem_loyalty_points > 0) && (
                                        <div className="mt-6 pt-6 border-t border-slate-100">
                                            <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">Loyalty Program</h4>
                                            <div className="flex justify-between items-center bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                                                <div>
                                                    <p className="text-[9px] font-black text-emerald-600 uppercase">Points Earned</p>
                                                    <p className="text-lg font-black text-emerald-700">{selectedInvoice.loyalty_points || 0}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-rose-500 uppercase">Redeemed</p>
                                                    <p className="text-lg font-black text-rose-600">{selectedInvoice.redeem_loyalty_points || 0}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="mt-8 pt-6 border-t border-slate-100">
                                        <div className="bg-slate-900 rounded-xl p-5 text-white">
                                            <span className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em]">Grand Total</span>
                                            <div className="text-3xl font-black mt-1 flex items-center justify-start gap-1.5">
                                                <DirhamIcon size={18} className="opacity-40" />
                                                {parseFloat(selectedInvoice.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <p className="text-[10px] font-bold opacity-40 mt-2 uppercase italic leading-tight">
                                                {selectedInvoice.in_words}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT: ITEMS TABLE */}
                            <div className="lg:col-span-2 flex flex-col gap-6">
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Itemized Breakdown</h4>
                                        <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500">
                                            {(selectedInvoice.items || []).length} ITEMS
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/50">
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Item</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Qty / UOM</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Tax (VAT)</th>
                                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Net Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedInvoice.items || []).map((it, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/70 transition-colors border-b border-slate-50 last:border-0 font-medium">
                                                        <td className="px-6 py-5">
                                                            <div className="text-[13px] font-black text-slate-800 leading-tight">{it.item_name}</div>
                                                            <div className="flex gap-2 items-center mt-1">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{it.item_name || it.name || it.item_code}</span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                                <span className="text-[10px] font-bold text-slate-500 italic">{it.warehouse?.split(' - ')[0]}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${isGreen ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                                                                    {it.qty}
                                                                </span>
                                                                <span className="text-[9px] font-black text-slate-400 mt-1 uppercase">{it.uom}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-right">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-black text-slate-700 flex items-center gap-1"><DirhamIcon size={12} /> {parseFloat(it.tax_amount || 0).toFixed(2)}</span>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase">{it.tax_rate}% VAT</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-right">
                                                            <div className="flex flex-col">
                                                                <span className="text-[15px] font-black text-slate-900 flex items-center gap-1"><DirhamIcon size={14} /> {parseFloat(it.amount || 0).toFixed(2)}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 italic">Rate: {parseFloat(it.rate || 0).toFixed(2)}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* TAXES BLOCK */}
                                {(selectedInvoice.taxes || []).length > 0 && (
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tax Analysis</h4>
                                        </div>
                                        <div className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {(selectedInvoice.taxes).map((tax, idx) => (
                                                    <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase leading-tight max-w-[70%]">
                                                                {tax.description}
                                                            </p>
                                                            <span className="text-xs font-black text-slate-900 flex items-center gap-1"><DirhamIcon size={11} /> {parseFloat(tax.tax_amount).toFixed(2)}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full ${isGreen ? 'bg-emerald-500' : 'bg-sky-500'}`} 
                                                                style={{ width: `${(tax.tax_amount / selectedInvoice.grand_total) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InvoiceList;
