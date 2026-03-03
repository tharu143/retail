import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useSelector } from "react-redux";
import { db } from '../../db';
import "./InvoiceList.css";

function InvoiceList() {
    const [invoices, setInvoices] = useState([]);
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filterId, setFilterId] = useState("");
    const [filterDate, setFilterDate] = useState("");
    const [filterTime, setFilterTime] = useState("");
    const [filterMobile, setFilterMobile] = useState("");
    const [filterMode, setFilterMode] = useState("");
    const [filterSource, setFilterSource] = useState(""); // 'all', 'synced', 'pending'
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [offlineInvoices, setOfflineInvoices] = useState([]);

    // Get session from Redux or localStorage
    const userData = useSelector((state) => state.user);
    const getSession = () => {
        return userData?.session || localStorage.getItem("session") || "";
    };

    // Load offline invoices from Dexie
    const loadOfflineInvoices = async () => {
        try {
            const local = await db.invoices.toArray();
            const mapped = local.map(inv => ({
                ...inv,
                name: inv.server_name || inv.offline_id || `LOCAL-${inv.id}`,
                offline_id: inv.offline_id,
                server_name: inv.server_name,
                customer_name: inv.customer,
                customer_details: {
                    customer_name: inv.customer || 'N/A',
                    mobile_no: inv.contact_mobile || 'N/A',
                    email_id: '',
                    address: '',
                },
                pos_invoice_items: (inv.items || []).map(it => ({
                    item_name: it.item_name || it.item_code,
                    item_code: it.item_code,
                    qty: it.quantity || it.qty || 1,
                    rate: it.basePrice || it.rate || 0,
                    amount: (it.quantity || it.qty || 1) * (it.basePrice || it.rate || 0),
                })),
                payments: inv.payments || [],
                grand_total: inv.grand_total || 0,
                posting_date: inv.posting_date || '',
                _source: (() => {
                    if (!inv.is_synced) return 'pending';
                    // Validate server_name is a real ERPNext ID (e.g. DXB-POS-INV-2026-00042, KS1-ACC-...)
                    const hasValidERPName = inv.server_name && /^[A-Za-z0-9]{2,}-/.test(inv.server_name);
                    if (hasValidERPName) return 'synced_local';
                    // is_synced=1 but no valid ERP name = sync was false positive
                    return 'sync_failed';
                })(),
                _synced_at: inv.synced_at || null,
                retry_count: inv.retry_count || 0,
                conflicts: inv.conflicts || [],
            }));
            setOfflineInvoices(mapped);
        } catch (e) {
            console.error('Failed to load offline invoices:', e);
        }
    };

    const fetchInvoices = async () => {
        const session = getSession();
        if (!session) {
            setError("Session not found. Please log in again.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        // Always load offline invoices first
        await loadOfflineInvoices();

        if (!navigator.onLine) {
            // When offline, only show local invoices (no error - just inform)
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(
                "/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_invoices",
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Frappe-SID": session,
                    },
                    credentials: "include",
                }
            );

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(`HTTP ${response.status}: ${txt}`);
            }

            const data = await response.json();

            if (data.message?.status === "success" && Array.isArray(data.message?.data)) {
                const mapped = data.message.data.map((raw) => ({
                    ...raw,
                    customer_details: {
                        customer_name: raw.customer_name || raw.customer || "N/A",
                        mobile_no: raw.contact_mobile || "N/A",
                        email_id: raw.contact_email || "N/A",
                        address: raw.customer_address || "N/A",
                    },
                    pos_invoice_items: raw.items || [],
                    payments: Array.isArray(raw.payments) ? raw.payments : [],
                    _source: 'server',
                }));
                setInvoices(mapped);
            } else {
                setInvoices([]);
            }
        } catch (err) {
            console.error("Fetch invoices error:", err);
            // Don't show error if we have offline data
            if (offlineInvoices.length === 0) {
                setError(`Failed to load invoices: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Track online/offline
    useEffect(() => {
        const goOnline = () => { setIsOffline(false); fetchInvoices(); };
        const goOffline = () => { setIsOffline(true); loadOfflineInvoices(); };
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    useEffect(() => {
        fetchInvoices();
    }, []);

    // Merge server invoices with pending offline invoices
    const getMergedInvoices = () => {
        const serverNames = new Set(invoices.map(inv => inv.name));
        // Only add offline invoices that are NOT already synced (to avoid duplicates)
        const pendingOffline = offlineInvoices.filter(
            inv => inv._source === 'pending' && !serverNames.has(inv.name)
        );
        return [...pendingOffline, ...invoices];
    };

    const filterInvoices = (list) => {
        return list.filter((inv) => {
            const idMatch = (inv.name?.toLowerCase().includes(filterId.toLowerCase())) ||
                (inv.offline_id?.toLowerCase().includes(filterId.toLowerCase()));
            const dateMatch = filterDate ? (inv.posting_date || "").includes(filterDate) : true;
            const timeMatch = filterTime ? (inv.posting_time || "").includes(filterTime) : true;
            const mobileMatch = filterMobile
                ? (inv.customer_details?.mobile_no || "")
                    .toLowerCase()
                    .includes(filterMobile.toLowerCase())
                : true;

            const paymentModes = (inv.payments || [])
                .map((p) => p.mode_of_payment || "")
                .filter(Boolean)
                .join(", ")
                .toLowerCase();

            const modeMatch = filterMode
                ? paymentModes.includes(filterMode.toLowerCase())
                : true;

            // Source filter
            let sourceMatch = true;
            if (filterSource === 'pending') sourceMatch = inv._source === 'pending';
            else if (filterSource === 'synced') sourceMatch = inv._source === 'server' || inv._source === 'synced_local';

            return idMatch && dateMatch && timeMatch && mobileMatch && modeMatch && sourceMatch;
        });
    };

    const getSyncBadge = (inv) => {
        if (inv._source === 'pending') {
            if ((inv.retry_count || 0) >= 5) {
                return <span style={{
                    background: '#fee2e2', color: '#991b1b', padding: '2px 8px',
                    borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700
                }}>❌ Failed (Max Retries)</span>;
            }
            return <span style={{
                background: '#fef3c7', color: '#92400e', padding: '2px 8px',
                borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700
            }}>⏳ Pending Sync {inv.retry_count > 0 ? `(Retry ${inv.retry_count}/5)` : ''}</span>;
        }
        if (inv._source === 'sync_failed') {
            return <span style={{
                background: '#fee2e2', color: '#991b1b', padding: '2px 8px',
                borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700
            }}>⚠️ Sync Failed - Invalid ERP ID</span>;
        }
        if (inv._source === 'synced_local') {
            return <span style={{
                background: '#d1fae5', color: '#065f46', padding: '2px 8px',
                borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700
            }}>✅ Synced {inv._synced_at ? new Date(inv._synced_at).toLocaleTimeString() : ''}</span>;
        }
        return <span style={{
            background: '#dbeafe', color: '#1e40af', padding: '2px 8px',
            borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700
        }}>☁️ Server</span>;
    };

    const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "N/A");
    const formatTime = (t) => {
        if (!t) return "N/A";
        try {
            const [h, m, s] = t.split(":").map(Number);
            const dt = new Date();
            dt.setHours(h, m, s);
            return dt.toLocaleTimeString("en-GB", { hour12: false });
        } catch {
            return "N/A";
        }
    };

    const formatDiscount = (inv) => {
        const pct = parseFloat(inv.additional_discount_percentage) || 0;
        const amt = parseFloat(inv.discount_amount) || 0;
        if (amt) return `AED ${amt.toFixed(2)}`;
        if (pct) return `${pct}%`;
        return "N/A";
    };

    const getPaymentDisplay = (payments) => {
        if (!payments || !payments.length) return "N/A";
        return payments
            .map((p) => `${p.mode_of_payment} (AED ${p.amount || 0})`)
            .join(" + ");
    };

    const generateInvoiceHTML = (invoice) => {
        return `
      <html>
        <head>
          <title>Invoice ${invoice.name}</title>
          <style>
            @page { margin:0; }
            body {font-family:Arial,sans-serif;padding:20px;font-size:12px;}
            .invoice-container {max-width:800px;margin:auto;}
            .invoice-details,.customer-details,.footer .totals,.offers-details {margin-bottom:15px;}
            .invoice-details p,.customer-details p,.footer .totals p,.offers-details p {margin:5px 0;display:flex;justify-content:space-between;}
            .invoice-details p strong,.customer-details p strong,.footer .totals p strong,.offers-details p strong {flex:0 0 40%;}
            .invoice-details p .value,.customer-details p .value,.footer .totals p .value,.offers-details p .value {flex:0 0 60%;text-align:right;}
            .customer-details {border-bottom:1px solid #000;padding-bottom:10px;}
            .offers-details {border-top:1px solid #000;padding-top:10px;}
            table {width:100%;border-collapse:collapse;margin-bottom:15px;}
            th,td {border:1px solid #000;padding:8px;text-align:right;}
            th {font-weight:bold;}
            .footer {display:flex;justify-content:flex-end;margin-top:15px;}
            .footer .totals {width:100%;max-width:300px;}
            .invoice-logo {display:flex;align-items:center;margin-bottom:10px;}
            .invoice-logo img {width:80px;height:80px;margin-right:10px;}
            .invoice-logo p {font-size:16px;font-weight:bold;margin:0;}
            @media print { @page{margin:0;} body{padding-top:0;} }
          </style>
        </head>
        <body>
          <div class="invoice-container">
              <div class="invoice-logo">
                <img src="/perfume-logo.png" alt="Logo"/>
              </div>
              <p><strong>Invoice ID (ERPNext):</strong> <span class="value">${invoice.server_name || "Pending Sync"}</span></p>
              <p><strong>Reference No:</strong> <span class="value">${invoice.offline_id || "N/A"}</span></p>
              <p><strong>Posting Date:</strong> <span class="value">${formatDate(invoice.posting_date)}</span></p>
              <p><strong>Posting Time:</strong> <span class="value">${formatTime(invoice.posting_time)}</span></p>
            </div>

            <div class="customer-details">
              <p><strong>Customer Name:</strong> <span class="value">${invoice.customer_details?.customer_name || "N/A"}</span></p>
              ${invoice.customer_details?.address ? `<p><strong>Address:</strong> <span class="value">${invoice.customer_details.address}</span></p>` : ""}
              <p><strong>Phone Number:</strong> <span class="value">${invoice.customer_details?.mobile_no || "N/A"}</span></p>
            </div>

            <table>
              <thead>
                <tr><th>Item Name</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
              </thead>
              <tbody>
                ${invoice.pos_invoice_items?.length
                ? invoice.pos_invoice_items
                    .map(
                        (i) => `<tr>
                          <td>${i.item_name || "N/A"}</td>
                          <td>${i.description || "N/A"}</td>
                          <td>${i.qty || 0}</td>
                          <td>AED ${i.rate || 0}</td>
                          <td>AED ${i.amount || 0}</td>
                        </tr>`
                    )
                    .join("")
                : `<tr><td colspan="5" style="text-align:center;">No items</td></tr>`
            }
              </tbody>
            </table>

            ${offers.length
                ? `<div class="offers-details">
                  <p><strong>Special Offers:</strong></p>
                  ${offers
                    .map(
                        (o) => `<p><span class="value">${o.messages || "N/A"} (Valid: ${formatDate(o.start_date)} to ${formatDate(o.end_date)})</span></p>`
                    )
                    .join("")}
                </div>`
                : ""
            }

            <div class="footer">
              <div class="totals">
                <p><strong>Total Taxes:</strong> <span class="value">AED ${invoice.total_taxes_and_charges || 0}</span></p>
                <p><strong>Discount:</strong> <span class="value">${formatDiscount(invoice)} (${invoice.apply_discount_on || "Grand Total"})</span></p>
                <p><strong>Currency:</strong> <span class="value">${invoice.currency || "AED"}</span></p>
                <p><strong>Paid Amount:</strong> <span class="value">AED ${invoice.paid_amount || 0}</span></p>
                <p><strong>Grand Total:</strong> <span class="value">AED ${invoice.grand_total || 0}</span></p>
                <p><strong>In Words:</strong> <span class="value">${invoice.in_words || "N/A"}</span></p>
                <p><strong>Mode of Payment:</strong> <span class="value">${getPaymentDisplay(invoice.payments)}</span></p>
              </div>
            </div>
          </div>
        </body>
      </html>`;
    };

    const handlePrintInvoice = (invoice) => {
        const win = window.open("", "_blank");
        win.document.write(generateInvoiceHTML(invoice));
        win.document.write(`
      <script>
        window.print();
        window.onafterprint = () => window.close();
      </script>
    `);
        win.document.close();
    };

    const handleViewDetails = (inv) => setSelectedInvoice(inv);
    const closePopup = () => setSelectedInvoice(null);

    const renderInvoiceTable = (list, title) => {
        if (!list.length)
            return (
                <div className="mb-4">
                    <h5 className="text-center mb-3">{title}</h5>
                    <p className="text-center">No invoices</p>
                </div>
            );

        return (
            <div className="mb-4">
                <h5 className="text-center mb-3">{title}</h5>
                <div className="table-responsive" style={{ maxHeight: "600px", overflowY: "auto" }}>
                    <table className="table table-bordered table-hover" style={{ fontSize: "14px" }}>
                        <thead className="thead-dark">
                            <tr>
                                <th>Invoice Details</th>
                                <th>Cashier</th>
                                <th>Customer</th>
                                <th>Payment</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((inv, idx) => (
                                <tr key={inv.name + '-' + idx} style={{
                                    background: inv._source === 'pending' ? '#fffbeb' : 'inherit'
                                }}>
                                    <td style={{ fontSize: '0.75rem' }}>
                                        <div style={{ fontWeight: 800, color: '#1e293b' }}>
                                            {inv.server_name || (inv._source === 'pending' ? 'UNSYNCED' : 'SYNCING...')}
                                        </div>
                                        <div style={{ color: '#64748b', fontSize: '0.65rem' }}>Ref No: {inv.offline_id}</div>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: '#475569' }}>
                                        {inv.owner || 'Local User'}
                                    </td>
                                    <td>{inv.customer_details?.customer_name || "N/A"}</td>
                                    <td style={{ fontSize: '0.75rem' }}>
                                        {(inv.payments || [])
                                            .map((p) => p.mode_of_payment)
                                            .filter(Boolean)
                                            .join(", ") || "N/A"}
                                    </td>
                                    <td style={{ fontWeight: 700 }}>AED {parseFloat(inv.grand_total || 0).toFixed(2)}</td>
                                    <td>{getSyncBadge(inv)}</td>
                                    <td>
                                        <button className="btn btn-sm btn-info" style={{ fontSize: '0.75rem', fontWeight: 600 }} onClick={() => handleViewDetails(inv)}>
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderInvoicePopup = () => {
        if (!selectedInvoice) return null;

        return (
            <div className="modal" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}>
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderBottom: '2px solid #f1f5f9' }}>
                            <h5 className="modal-title" style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>
                                {selectedInvoice.server_name || 'Pending Sync'}
                            </h5>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                <strong>Reference No:</strong> {selectedInvoice.offline_id}
                            </div>
                            <button type="button" className="btn-close" onClick={closePopup} style={{ position: 'absolute', right: '1rem', top: '1.5rem' }}></button>
                        </div>
                        <div className="modal-body">
                            <div className="d-flex align-items-center mb-2">
                                <img
                                    src="/perfume-logo.png"
                                    alt="logo"
                                    style={{ width: "80px", height: "80px", marginRight: "10px" }}
                                />
                            </div>
                            <p><strong>Posting Date:</strong> {formatDate(selectedInvoice.posting_date)}</p>
                            <p><strong>Posting Time:</strong> {formatTime(selectedInvoice.posting_time)}</p>
                            <p><strong>Customer:</strong> {selectedInvoice.customer_details?.customer_name || "N/A"}</p>
                            {selectedInvoice.customer_details?.address && (
                                <p><strong>Address:</strong> {selectedInvoice.customer_details.address}</p>
                            )}
                            <p><strong>Phone:</strong> {selectedInvoice.customer_details?.mobile_no || "N/A"}</p>

                            {/* Sync Conflict Alerts */}
                            {(selectedInvoice.conflicts || []).length > 0 && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <h6 className="text-red-800 font-bold mb-2 flex items-center gap-2">
                                        <AlertCircle size={16} /> Sync Conflicts Detected
                                    </h6>
                                    <ul className="mb-0 ps-3">
                                        {selectedInvoice.conflicts.map((c, i) => (
                                            <li key={i} className="text-red-700 text-sm font-medium">
                                                {c.type === 'price_mismatch' ? `Price Mismatch: ${c.details || c.message}` :
                                                    c.type === 'stock_low' ? `Low Stock Warning: ${c.details || c.message}` :
                                                        c.message || 'Unknown Conflict'}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedInvoice.retry_count > 0 && selectedInvoice._source === 'pending' && (
                                <div className="mt-2 text-xs text-amber-600 font-bold">
                                    ⚠️ Sync retry attempt: {selectedInvoice.retry_count}/5
                                </div>
                            )}

                            <h6 className="mt-3">Items</h6>
                            {selectedInvoice.pos_invoice_items?.length ? (
                                <div className="table-responsive">
                                    <table className="table table-bordered">
                                        <thead>
                                            <tr>
                                                <th>Item</th>
                                                <th>Description</th>
                                                <th className="text-end">Qty</th>
                                                <th className="text-end">Rate</th>
                                                <th className="text-end">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoice.pos_invoice_items.map((it, i) => (
                                                <tr key={i}>
                                                    <td>{it.item_name}</td>
                                                    <td>{it.description}</td>
                                                    <td className="text-end">{it.qty}</td>
                                                    <td className="text-end">AED {it.rate}</td>
                                                    <td className="text-end">AED {it.amount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p>No items</p>
                            )}

                            {offers.length > 0 && (
                                <div className="mt-3">
                                    <h6>Special Offers</h6>
                                    {offers.map((o, i) => (
                                        <p key={i}>
                                            {o.messages} (Valid: {formatDate(o.start_date)} – {formatDate(o.end_date)})
                                        </p>
                                    ))}
                                </div>
                            )}

                            <div className="mt-3">
                                <p><strong>Total Taxes:</strong> AED {selectedInvoice.total_taxes_and_charges || 0}</p>
                                <p>
                                    <strong>Discount:</strong> {formatDiscount(selectedInvoice)} (
                                    {selectedInvoice.apply_discount_on || "Grand Total"})
                                </p>
                                <p><strong>Currency:</strong> {selectedInvoice.currency || "AED"}</p>
                                <p><strong>Paid Amount:</strong> AED {selectedInvoice.paid_amount || 0}</p>
                                <p><strong>Grand Total:</strong> AED {selectedInvoice.grand_total || 0}</p>
                                <p><strong>In Words:</strong> {selectedInvoice.in_words || "N/A"}</p>
                                <p><strong>Mode of Payment:</strong> {getPaymentDisplay(selectedInvoice.payments)}</p>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-success" onClick={() => handlePrintInvoice(selectedInvoice)}>
                                Print
                            </button>
                            <button className="btn btn-secondary" onClick={closePopup}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const splitInvoicesIntoThree = () => {
        const merged = getMergedInvoices();
        const filtered = filterInvoices(merged);
        const third = Math.ceil(filtered.length / 3);
        return {
            part1: filtered.slice(0, third),
            part2: filtered.slice(third, third * 2),
            part3: filtered.slice(third * 2),
            total: filtered.length,
        };
    };

    const renderContent = () => {
        if (loading) return <p className="text-center">Loading invoices…</p>;
        if (error) return <div className="alert alert-danger">{error}</div>;

        const merged = getMergedInvoices();
        if (!merged.length) return <p className="text-center">No POS Invoices found.</p>;

        const { part1, part2, part3 } = splitInvoicesIntoThree();

        return (
            <>
                <div className="row mb-4 justify-content-center">
                    <div className="col-md-3">
                        <label className="form-label fw-bold">Invoice / Offline ID</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. POSINV or Off-ID"
                            value={filterId}
                            onChange={(e) => setFilterId(e.target.value)}
                        />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label fw-bold">Date</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="YYYY-MM-DD"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                        />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label fw-bold">Time</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="HH:MM"
                            value={filterTime}
                            onChange={(e) => setFilterTime(e.target.value)}
                        />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label fw-bold">Mobile</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. 9876543210"
                            value={filterMobile}
                            onChange={(e) => setFilterMobile(e.target.value)}
                        />
                    </div>
                    <div className="col-md-2 mt-2">
                        <label className="form-label fw-bold">Mode of Payment</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. Cash, Card"
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value)}
                        />
                    </div>
                    <div className="col-md-2 mt-2">
                        <label className="form-label fw-bold">Sync Status</label>
                        <select
                            className="form-control"
                            value={filterSource}
                            onChange={(e) => setFilterSource(e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="synced">Synced</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                </div>

                <div className="row">
                    <div className="col-md-4 px-2">{renderInvoiceTable(part1, "")}</div>
                    <div className="col-md-4 px-2">{renderInvoiceTable(part2, "")}</div>
                    <div className="col-md-4 px-2">{renderInvoiceTable(part3, "")}</div>
                </div>

                {renderInvoicePopup()}
            </>
        );
    };

    const pendingCount = offlineInvoices.filter(i => i._source === 'pending').length;

    return (
        <div className="container-fluid mt-4">
            <div className="d-flex justify-content-center align-items-center gap-3 mb-4">
                <h3 className="mb-0">POS Invoices</h3>
                {isOffline && (
                    <span style={{
                        background: '#fef2f2', color: '#991b1b', padding: '4px 12px',
                        borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid #fecaca'
                    }}>🔴 Offline Mode</span>
                )}
                {pendingCount > 0 && (
                    <span style={{
                        background: '#fffbeb', color: '#92400e', padding: '4px 12px',
                        borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, border: '1px solid #fde68a'
                    }}>⏳ {pendingCount} pending sync</span>
                )}
            </div>
            {renderContent()}
        </div>
    );
}

export default InvoiceList;