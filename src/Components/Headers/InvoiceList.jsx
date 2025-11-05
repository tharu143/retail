import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
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
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Get session from Redux or localStorage
    const userData = useSelector((state) => state.user);
    const getSession = () => {
        return userData?.session || localStorage.getItem("session") || "";
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
                // <<< MAP HERE >>>
                const mapped = data.message.data.map((raw) => ({
                    ...raw,
                    customer_details: {
                        customer_name: raw.customer_name || raw.customer || "N/A",
                        mobile_no: raw.contact_mobile || "N/A",
                        email_id: raw.contact_email || "N/A",
                        address: raw.customer_address || "N/A",
                    },
                    pos_invoice_items: raw.items || [],
                }));
                setInvoices(mapped);
            } else {
                setError("No invoices returned from the server.");
            }
        } catch (err) {
            console.error("Fetch invoices error:", err);
            setError(`Failed to load invoices: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        Promise.all([fetchInvoices()]).finally(() => setLoading(false));
    }, []);

    const filterInvoices = (list) => {
        return list.filter((inv) => {
            const idMatch = inv.name?.toLowerCase().includes(filterId.toLowerCase());
            const dateMatch = filterDate ? (inv.posting_date || "").includes(filterDate) : true;
            const timeMatch = filterTime ? (inv.posting_time || "").includes(filterTime) : true;
            const mobileMatch = filterMobile
                ? (inv.customer_details?.mobile_no || "")
                    .toLowerCase()
                    .includes(filterMobile.toLowerCase())
                : true;
            return idMatch && dateMatch && timeMatch && mobileMatch;
        });
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
            <div class="invoice-details">
              <div class="invoice-logo">
                <img src="/perfume-logo.png" alt="Logo"/>
              </div>
              <p><strong>Invoice ID:</strong> <span class="value">${invoice.name}</span></p>
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
                                <th>Invoice ID</th>
                                <th>Customer</th>
                                <th>Grand Total</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.map((inv) => (
                                <tr key={inv.name}>
                                    <td>{inv.name}</td>
                                    <td>{inv.customer_details?.customer_name || "N/A"}</td>
                                    <td>AED {inv.grand_total || 0}</td>
                                    <td>
                                        <button className="btn btn-sm btn-info" onClick={() => handleViewDetails(inv)}>
                                            View Details
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
                        <div className="modal-header">
                            <h5 className="modal-title">Invoice – {selectedInvoice.name}</h5>
                            <button type="button" className="btn-close" onClick={closePopup}></button>
                        </div>
                        <div className="modal-body">
                            {/* Header */}
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

                            {/* Items */}
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

                            {/* Offers */}
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

                            {/* Totals */}
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
        const filtered = filterInvoices(invoices);
        const third = Math.ceil(filtered.length / 3);
        return {
            part1: filtered.slice(0, third),
            part2: filtered.slice(third, third * 2),
            part3: filtered.slice(third * 2),
        };
    };

    const renderContent = () => {
        if (loading) return <p className="text-center">Loading invoices…</p>;
        if (error) return <div className="alert alert-danger">{error}</div>;
        if (!invoices.length) return <p className="text-center">No POS Invoices found.</p>;

        const { part1, part2, part3 } = splitInvoicesIntoThree();

        return (
            <>
                {/* FILTERS */}
                <div className="row mb-4 justify-content-center">
                    <div className="col-md-3">
                        <label className="form-label fw-bold">Invoice ID</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. POSINV-001"
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
                </div>

                {/* THREE COLUMNS */}
                <div className="row">
                    <div className="col-md-4 px-2">{renderInvoiceTable(part1, "")}</div>
                    <div className="col-md-4 px-2">{renderInvoiceTable(part2, "")}</div>
                    <div className="col-md-4 px-2">{renderInvoiceTable(part3, "")}</div>
                </div>

                {renderInvoicePopup()}
            </>
        );
    };

    return (
        <div className="container-fluid mt-4">
            <h3 className="mb-4 text-center">POS Invoices</h3>
            {renderContent()}
        </div>
    );
}

export default InvoiceList