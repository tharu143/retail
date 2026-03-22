import { useEffect, useState, useMemo } from "react";
import {
    AlertCircle, Search, Calendar, Clock, CreditCard,
    CheckCircle, Cloud, RefreshCw, XCircle, FileText,
    Printer, Eye, Filter, Trash2, ArrowLeft, Smartphone, Palette, Loader2, Link
} from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { db } from '../../db';
import "../Admin/SalesOrder.css";

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

    // Sync Theme
    const [invTheme, setInvTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
    const isGreen = invTheme === 'green';
    const themeColor = isGreen ? '#10b981' : '#0ea5e9';
    const themeColorHover = isGreen ? '#059669' : '#0284c7';
    const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

    useEffect(() => {
        localStorage.setItem('legacySubTheme', invTheme);
        document.documentElement.style.setProperty('--so-primary', themeColor);
        document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--so-primary-light', themeLight);
    }, [invTheme, themeColor, themeColorHover, themeLight]);

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
        const cashier = userData?.user?.split('@')[0].toUpperCase() || 'CASHIER';
        const companyName = userData?.company || 'RETAIL POS';
        const address = userData?.warehouse || 'Main Store';
        const tel = '+971 00 000 0000';

        const invoiceItems = (invoice.pos_invoice_items || invoice.items || []);
        const barCodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoice.name}&scale=2&height=10`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Bill Print - ${invoice.name}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { width: 72mm; margin: 0 auto; padding: 10px 0; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.2; }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .divider { border-top: 1px dashed #000; margin: 8px 0; }
                        .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
                        .info-row { display: flex; justify-content: space-between; font-size: 11px; }
                        .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
                        .items-table th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; }
                        .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
                        .grand-total { font-size: 16px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
                        .barcode { display: block; margin: 15px auto; width: 100%; max-height: 40px; }
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
                        <div class="info-row"><span>CASHIER:</span> <span class="bold">#${cashier}</span></div>
                        <div class="info-row"><span>DATE:</span> <span>${invoice.posting_date}</span></div>
                        <div class="info-row"><span>INV NO:</span> <span class="bold">${invoice.name}</span></div>
                    </div>
                    <table class="items-table">
                        <thead>
                            <tr><th style="width: 50%;">ITEM</th><th style="text-align:right">QTY</th><th style="text-align:right">PRICE</th></tr>
                        </thead>
                        <tbody>
                            ${invoiceItems.map(it => `
                                <tr>
                                    <td>${String(it.item_name || it.item_code).substring(0, 20)}</td>
                                    <td style="text-align:right">${it.qty || 1}</td>
                                    <td style="text-align:right">${parseFloat(it.rate || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="divider"></div>
                    <div class="totals">
                        <div class="total-row bold grand-total"><span>TOTAL</span><span>AED ${parseFloat(invoice.grand_total).toFixed(2)}</span></div>
                    </div>
                    <div class="center"><img class="barcode" src="${barCodeUrl}" /><p>THANK YOU!</p></div>
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
                        onClick={() => setInvTheme(isGreen ? 'blue' : 'green')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.9rem', background: '#f8fafc',
                            border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                            fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                            cursor: 'pointer', transition: 'all 0.2s',
                            textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}
                    >
                        <Palette size={13} /> {invTheme.toUpperCase()}
                    </button>
                    <button className="so-btn-primary" onClick={loadData} disabled={loading}>
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
                        <input type="date" className="so-filter-input" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
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
                                                        <Calendar size={12} style={{ color: '#64748b' }} /> {inv.posting_date}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.7rem', marginTop: '4px' }}>
                                                        <Clock size={12} /> {inv.posting_time || '--:--'}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{inv.customer_name}</td>
                                                <td style={{ fontWeight: 800, textAlign: 'right', fontSize: '0.9rem' }}>
                                                    AED {parseFloat(inv.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                <div className="so-modal-overlay" onClick={() => setSelectedInvoice(null)}>
                    <div className="so-modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="so-modal-header">
                            <div>
                                <h3 className="so-modal-title">{selectedInvoice.name}</h3>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                                    {selectedInvoice.offline_id ? `Ref: ${selectedInvoice.offline_id}` : 'Server Transaction'}
                                </p>
                            </div>
                            <button className="so-modal-close" onClick={() => setSelectedInvoice(null)}><XCircle size={20} /></button>
                        </div>
                        <div className="so-modal-body">
                            <div className="so-summary-bar">
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Customer</span>
                                    <span className="so-summary-value">{selectedInvoice.customer_name}</span>
                                </div>
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Date</span>
                                    <span className="so-summary-value">{selectedInvoice.posting_date}</span>
                                </div>
                                <div className="so-summary-item">
                                    <span className="so-summary-label">Total Amount</span>
                                    <span className="so-summary-value grand">AED {parseFloat(selectedInvoice.grand_total).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="so-card">
                                <div className="so-card-header">
                                    <span className="so-card-title">Transaction Items</span>
                                </div>
                                <div className="so-card-body" style={{ padding: 0 }}>
                                    <div className="so-items-table-wrap">
                                        <table className="so-items-table">
                                            <thead>
                                                <tr>
                                                    <th>Item</th>
                                                    <th style={{ textAlign: 'right' }}>Qty</th>
                                                    <th style={{ textAlign: 'right' }}>Rate</th>
                                                    <th style={{ textAlign: 'right' }}>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedInvoice.pos_invoice_items || selectedInvoice.items || []).map((it, i) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <div className="so-item-display-name">{it.item_name || it.item_code}</div>
                                                            <div className="so-item-display-code">{it.item_code}</div>
                                                        </td>
                                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{it.qty || it.quantity}</td>
                                                        <td style={{ textAlign: 'right' }}>{parseFloat(it.rate || 0).toFixed(2)}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 800 }}>
                                                            {((it.qty || 1) * (it.rate || 0)).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="so-modal-footer">
                            <button className="so-btn-secondary" onClick={() => setSelectedInvoice(null)}>Close</button>
                            <button className="so-btn-primary" onClick={() => handlePrint(selectedInvoice)}>
                                <Printer size={16} /> Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InvoiceList;
