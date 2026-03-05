import { useEffect, useState, useMemo } from "react";
import {
    AlertCircle, Search, Calendar, Clock, CreditCard,
    CheckCircle, Cloud, RefreshCw, XCircle, FileText,
    Printer, Eye, Filter, Trash2, ArrowLeft, Smartphone
} from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { db } from '../../db';
import "./InvoiceList.css";

function InvoiceList() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Modern Filter State
    const [filterId, setFilterId] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [filterTime, setFilterTime] = useState("");
    const [filterMobile, setFilterMobile] = useState("");
    const [filterMode, setFilterMode] = useState("");
    const [filterSource, setFilterSource] = useState(""); // 'all', 'synced', 'pending'

    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [offlineInvoices, setOfflineInvoices] = useState([]);

    // NEW: Search Suggestions
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
                    "/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_invoices",
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
            setError("Failed to synchronize invoice list. Local data is still available.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Auto-refresh every 30s
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

    const getStatusBadge = (inv) => {
        if (inv._source === 'pending') {
            return <span className="status-badge status-pending"><RefreshCw size={12} className="animate-spin" /> Pending</span>;
        }
        if (inv._source === 'sync_failed') {
            return <span className="status-badge status-failed"><XCircle size={12} /> Sync Error</span>;
        }
        if (inv._source === 'synced_local') {
            return <span className="status-badge status-synced"><CheckCircle size={12} /> Synced</span>;
        }
        return <span className="status-badge status-server"><Cloud size={12} /> Server</span>;
    };

    const handlePrint = (invoice) => {
        const cashier = userData?.user?.split('@')[0].toUpperCase() || 'CASHIER';
        const companyName = userData?.company || 'KYLE RETAIL';
        const address = userData?.warehouse || 'Main Store Address';
        const tel = '+971 00 000 0000';

        const invoiceItems = (invoice.pos_invoice_items || invoice.items || []);
        const barCodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoice.name}&scale=2&height=10`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Receipt - ${invoice.name}</title>
                    <style>
                        @page { size: 80mm auto; margin: 0; }
                        body { 
                            width: 72mm; margin: 0 auto; padding: 10px 0; 
                            font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.2; color: #000;
                        }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .divider { border-top: 1px dashed #000; margin: 8px 0; }
                        .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; }
                        .header p { margin: 2px 0; font-size: 11px; }
                        .info { margin: 10px 0; font-size: 11px; }
                        .info-row { display: flex; justify-content: space-between; }
                        .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        .items-table th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px; }
                        .items-table td { padding: 4px 0; vertical-align: top; font-size: 11px; }
                        .text-right { text-align: right; }
                        .totals { margin: 8px 0; }
                        .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
                        .grand-total { font-size: 16px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
                        .barcode { display: block; margin: 15px auto; width: 100%; max-height: 40px; }
                        .footer { font-size: 10px; margin-top: 15px; }
                        @media print { body { width: 72mm; margin: 0 auto; } }
                    </style>
                </head>
                <body>
                    <div class="header center">
                        <h2 class="bold">${companyName}</h2>
                        <p>${address}</p>
                        <p>Tel: ${tel}</p>
                    </div>
                    <div class="divider"></div>
                    <div class="info">
                        <div class="info-row"><span>CASHIER:</span> <span class="bold">#${cashier}</span></div>
                        <div class="info-row"><span>DATE:</span> <span>${invoice.posting_date}</span></div>
                        <div class="info-row"><span>TIME:</span> <span>${invoice.posting_time || '--:--'}</span></div>
                        <div class="info-row"><span>INV NO:</span> <span class="bold">${invoice.name}</span></div>
                    </div>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 50%;">ITEM</th>
                                <th class="text-right" style="width: 15%;">QTY</th>
                                <th class="text-right" style="width: 35%;">PRICE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoiceItems.map(it => `
                                <tr>
                                    <td>${String(it.item_name || it.item_code || it.name || 'ITEM').substring(0, 20)}</td>
                                    <td class="text-right">${it.qty || 1}</td>
                                    <td class="text-right">${parseFloat(it.rate || it.basePrice || 0).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="divider"></div>
                    <div class="totals">
                        <div class="total-row bold">
                            <span>SUB TOTAL</span>
                            <span>AED ${parseFloat(invoice.grand_total).toFixed(2)}</span>
                        </div>
                        <div class="total-row grand-total bold">
                            <span>TOTAL</span>
                            <span>AED ${parseFloat(invoice.grand_total).toFixed(2)}</span>
                        </div>
                        <div class="total-row" style="margin-top: 10px;">
                            <span>CASH</span>
                            <span>AED ${parseFloat(invoice.grand_total).toFixed(2)}</span>
                        </div>
                        <div class="total-row">
                            <span>CHANGE</span>
                            <span>AED 0.00</span>
                        </div>
                    </div>
                    <div class="center">
                        <img class="barcode" src="${barCodeUrl}" />
                        <div class="footer">
                            <p class="bold" style="font-size: 12px;">THANK YOU!</p>
                            <p>GLAD TO SEE YOU AGAIN!</p>
                            <p style="margin-top: 5px; opacity: 0.7;">Powered by KYLE RETAIL</p>
                        </div>
                    </div>
                    <script>
                        window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="invoice-list-container">
            <div className="invoice-list-header">
                <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                    POS Invoice Management
                </h2>
                <p style={{ color: '#64748b' }}>View, filter, and track all your sales transactions in one place.</p>
            </div>

            {/* Premium Filter Card */}
            <div className="filter-card">
                <div className="filter-grid">
                    <div className="filter-item" style={{ position: 'relative' }}>
                        <label><Search size={14} /> ID / Offline ID</label>
                        <div className="filter-input-wrapper">
                            <input
                                type="text"
                                className="filter-input"
                                placeholder="Search IDs..."
                                value={filterId}
                                onChange={(e) => { setFilterId(e.target.value); setShowIdSuggestions(true); }}
                                onFocus={() => setShowIdSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowIdSuggestions(false), 200)}
                            />
                            {showIdSuggestions && idSuggestions.length > 0 && (
                                <div className="suggestion-dropdown">
                                    {idSuggestions.map((id, i) => (
                                        <div
                                            key={i}
                                            className="suggestion-item"
                                            onClick={() => { setFilterId(id); setShowIdSuggestions(false); }}
                                        >
                                            {id}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="filter-item">
                        <label><Calendar size={14} /> Date</label>
                        <input
                            type="date"
                            className="filter-input"
                            style={{ paddingLeft: '1rem' }}
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                        />
                    </div>

                    <div className="filter-item">
                        <label><Clock size={14} /> Time</label>
                        <input
                            type="time"
                            className="filter-input"
                            style={{ paddingLeft: '1rem' }}
                            value={filterTime}
                            onChange={(e) => setFilterTime(e.target.value)}
                        />
                    </div>

                    <div className="filter-item">
                        <label><CreditCard size={14} /> Payment Mode</label>
                        <select
                            className="filter-input filter-select"
                            style={{ paddingLeft: '1rem' }}
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value)}
                        >
                            <option value="">All Modes</option>
                            <option value="Cash">Cash</option>
                            <option value="Credit Card">Credit Card</option>
                            <option value="Bank">Bank</option>
                            <option value="Store Credit">Store Credit</option>
                        </select>
                    </div>

                    <div className="filter-item">
                        <label><Smartphone size={14} /> Mobile</label>
                        <input
                            type="text"
                            className="filter-input"
                            style={{ paddingLeft: '1rem' }}
                            placeholder="Customer mobile..."
                            value={filterMobile}
                            onChange={(e) => setFilterMobile(e.target.value)}
                        />
                    </div>

                    <div className="filter-item">
                        <label><Filter size={14} /> Sync Status</label>
                        <select
                            className="filter-input filter-select"
                            style={{ paddingLeft: '1rem' }}
                            value={filterSource}
                            onChange={(e) => setFilterSource(e.target.value)}
                        >
                            <option value="">All Statuses</option>
                            <option value="synced">Synced (Live)</option>
                            <option value="pending">Pending Sync</option>
                        </select>
                    </div>

                    <div className="filter-item" style={{ justifyContent: 'flex-end' }}>
                        <button className="action-btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={clearFilters}>
                            <Trash2 size={16} /> Clear All
                        </button>
                    </div>
                </div>
            </div>

            {/* Invoice List Table */}
            <div className="invoice-table-card">
                {loading && (
                    <div className="empty-state">
                        <RefreshCw size={32} className="animate-spin mb-3" />
                        <p>Synchronizing sales data...</p>
                    </div>
                )}

                {!loading && filteredInvoices.length === 0 && (
                    <div className="empty-state">
                        <FileText size={48} className="empty-state-icon" />
                        <h3>No Invoices Found</h3>
                        <p>No transactions match your current filter criteria.</p>
                        <button className="btn-view action-btn mt-3" onClick={clearFilters}>Reset Filters</button>
                    </div>
                )}

                {!loading && filteredInvoices.length > 0 && (
                    <div className="table-responsive">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Invoice ID / Reference</th>
                                    <th>Posting Info</th>
                                    <th>Customer</th>
                                    <th>Grand Total</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map((inv, idx) => (
                                    <tr key={inv.name + idx}>
                                        <td>
                                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{inv.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                                Ref: {inv.offline_id || inv.name}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569' }}>
                                                <Calendar size={12} /> {inv.posting_date}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
                                                <Clock size={12} /> {inv.posting_time || '--:--'}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 500 }}>{inv.customer_name}</td>
                                        <td style={{ fontWeight: 800, color: '#16a34a' }}>
                                            AED {parseFloat(inv.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td>{getStatusBadge(inv)}</td>
                                        <td>
                                            <button className="action-btn btn-view" onClick={() => setSelectedInvoice(inv)}>
                                                <Eye size={14} /> View
                                            </button>
                                            <button className="action-btn btn-print" onClick={() => handlePrint(inv)}>
                                                <Printer size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detailed Invoice Popup */}
            {selectedInvoice && (
                <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
                    <div className="modern-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3>{selectedInvoice.name}</h3>
                                <p>Reference: {selectedInvoice.offline_id || selectedInvoice.name}</p>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedInvoice(null)}><XCircle size={24} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="details-grid">
                                <div className="detail-item">
                                    <label>Customer</label>
                                    <p>{selectedInvoice.customer_name}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Date & Time</label>
                                    <p>{selectedInvoice.posting_date} {selectedInvoice.posting_time}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Grand Total</label>
                                    <p style={{ color: '#16a34a', fontWeight: 800 }}>AED {parseFloat(selectedInvoice.grand_total || 0).toFixed(2)}</p>
                                </div>
                                <div className="detail-item">
                                    <label>Mode of Payment</label>
                                    <p>{(selectedInvoice.payments || []).map(p => p.mode_of_payment).join(', ') || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="items-section">
                                <label>Invoice Items</label>
                                <table className="items-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th className="text-right">Qty</th>
                                            <th className="text-right">Rate</th>
                                            <th className="text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedInvoice.pos_invoice_items || selectedInvoice.items || []).map((it, i) => (
                                            <tr key={i}>
                                                <td>{it.item_name || it.item_code}</td>
                                                <td className="text-right">{it.qty || it.quantity}</td>
                                                <td className="text-right">AED {(it.rate || it.basePrice || 0).toFixed(2)}</td>
                                                <td className="text-right">AED {((it.qty || it.quantity || 1) * (it.rate || it.basePrice || 0)).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="action-btn btn-print" onClick={() => handlePrint(selectedInvoice)} style={{ width: '100%', justifyContent: 'center' }}>
                                <Printer size={18} /> Print Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default InvoiceList;