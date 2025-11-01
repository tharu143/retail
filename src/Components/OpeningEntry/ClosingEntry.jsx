import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import './ClosingEntry.css';

function ClosingEntry() {
  const [openingEntries, setOpeningEntries] = useState([]);
  const [selectedOpeningEntry, setSelectedOpeningEntry] = useState('');
  const [company, setCompany] = useState('');
  const [invoicesData, setInvoicesData] = useState(null); 
  const [paymentReconciliation, setPaymentReconciliation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [noInvoicesMessage, setNoInvoicesMessage] = useState('');
  const navigate = useNavigate();
  const userData = useSelector((state) => state.user);
  const closingAmountRefs = useRef([]);

  const getCurrentISTDateTime = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    return istTime.toISOString().slice(0, 16); // Format as YYYY-MM-DDTHH:mm
  };
  const [postingDate, setPostingDate] = useState(getCurrentISTDateTime());
  const [periodEndDate, setPeriodEndDate] = useState(getCurrentISTDateTime());

  // Helper to get session
  const getSession = () => {
    return localStorage.getItem('session') || userData?.session || '';
  };

  // Initialize company and log userData for debugging
  useEffect(() => {
    console.log('userData from Redux:', userData);
    const reduxCompany = userData?.company || localStorage.getItem('company') || '';
    setCompany(reduxCompany);
    if (!reduxCompany) {
      setError('Company details are missing. Please log in again.');
    }
  }, [userData]);

  // Fetch POS Opening Entries using session auth
  useEffect(() => {
    const fetchOpeningEntries = async () => {
      try {
        setLoading(true);
        const session = getSession();
        const response = await fetch('/api/resource/POS Opening Entry?filters=[["docstatus","=",1]]&fields=["name","period_start_date","pos_profile","company","user"]', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(session ? { 'X-Frappe-SID': session } : {}),
          },
          credentials: 'include', // Include cookies for session
        });
        if (!response.ok) throw new Error(`Failed to fetch POS Opening Entries: ${response.status}`);
        const data = await response.json();
        console.log('Opening Entries Response:', data);
        setOpeningEntries(data.data || []);
        setLoading(false);
      } catch (err) {
        setError(`Failed to load POS Opening Entries: ${err.message}`);
        setLoading(false);
      }
    };
    fetchOpeningEntries();
  }, []);

  // Fetch POS Opening Entries using whitelisted method
useEffect(() => {
  const fetchOpeningEntries = async () => {
    try {
      setLoading(true);
      const session = getSession();
      const response = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_invoices_for_closing', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'X-Frappe-SID': session } : {}),
        },
        credentials: 'include', // For session cookies
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log('Opening Entries Response:', data);

      if (data.status === 'error') {
        throw new Error(data.message || 'Failed to fetch opening entries');
      }

      setOpeningEntries(data.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Fetch Opening Entries Error:', err);
      setError(`Failed to load POS Opening Entries: ${err.message}`);
      setLoading(false);
    }
  };
  fetchOpeningEntries();
}, []); // Empty dep array, runs once// Fetch POS Opening Entries using whitelisted method
useEffect(() => {
  const fetchOpeningEntries = async () => {
    try {
      setLoading(true);
      const session = getSession();
      const response = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_opening_entries', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'X-Frappe-SID': session } : {}),
        },
        credentials: 'include', // For session cookies
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json();
      console.log('Opening Entries Response:', data);

      if (data.status === 'error') {
        throw new Error(data.message || 'Failed to fetch opening entries');
      }

      setOpeningEntries(data.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Fetch Opening Entries Error:', err);
      setError(`Failed to load POS Opening Entries: ${err.message}`);
      setLoading(false);
    }
  };
  fetchOpeningEntries();
}, []); // Empty dep array, runs once

  // Auto-focus first closing amount input when reconciliation loads
  useEffect(() => {
    if (paymentReconciliation.length > 0 && closingAmountRefs.current[0]) {
      closingAmountRefs.current[0].focus();
    }
  }, [paymentReconciliation]);

  // Handle closing amount input
  const handleClosingAmountChange = (index, value) => {
    const closingAmount = parseFloat(value) || 0;
    if (closingAmount < 0) {
      alert('Closing Amount cannot be negative.');
      return;
    }
    setPaymentReconciliation(prev => {
      const newPr = [...prev];
      newPr[index].closing_amount = closingAmount;
      newPr[index].difference = flt(newPr[index].expected_amount) - flt(closingAmount);
      return newPr;
    });
  };

  // Helper function to simulate Frappe's flt (round to 2 decimals)
  const flt = (value) => Math.round(parseFloat(value || 0) * 100) / 100;

  const handleSubmit = async (saveAsDraft = false) => {
    if (!selectedOpeningEntry || !company || !postingDate || !periodEndDate) {
      alert('Please fill all required fields: POS Opening Entry, Posting Date, Period End Date.');
      return;
    }
    // ADDED: Basic date validation
    const postDate = new Date(postingDate);
    const endDate = new Date(periodEndDate);
    if (endDate < postDate) {
      alert('Period End Date cannot be before Posting Date.');
      return;
    }
    if (!invoicesData) {
      alert('No invoice data available. Please select a valid POS Opening Entry with invoices.');
      return;
    }
    if (paymentReconciliation.some(pr => pr.closing_amount === undefined || pr.closing_amount === null)) {
      alert('Please enter Closing Amount for all payment modes.');
      return;
    }

    const payload = {
      pos_opening_entry: selectedOpeningEntry,
      posting_date: postingDate,
      period_end_date: periodEndDate,
      pos_transactions: JSON.stringify(invoicesData.pos_transactions),
      payment_reconciliation: JSON.stringify(paymentReconciliation),
      taxes: JSON.stringify(invoicesData.taxes),
      grand_total: flt(invoicesData.grand_total),
      net_total: flt(invoicesData.net_total),
      total_quantity: flt(invoicesData.total_quantity),
      company: company,
      save_as_draft: saveAsDraft
    };

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');
      const session = getSession();
      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      const response = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_closing_entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { 'X-Frappe-SID': session } : {}),
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify(payload),
      });
      console.log('Response status:', response.status, 'OK:', response.ok);
      const data = await response.json();
      console.log('Server response:', data);

      // FIXED: Correct parsing - use data.message.status and data.message.name
      if (!response.ok) throw new Error(`Failed to create closing entry: ${data.message?.message || data.message || 'Unknown error'}`);
      if (data.message?.status === 'error') throw new Error(data.message.message || 'Failed to create closing entry');

      // Set success message using the correct response structure
      setSuccessMessage(
        `POS Closing Entry ${saveAsDraft ? 'saved as draft' : 'created and submitted'} successfully! ` +
        `Name: ${data.message?.name || 'Unknown'}, ` +
        `Grand Total: ₹${(data.message?.grand_total || 0).toFixed(2)}, ` +
        `Status: ${data.message?.status || 'Unknown'}`
      );
      setInvoicesData(null);
      setSelectedOpeningEntry('');
      setPaymentReconciliation([]);
      setNoInvoicesMessage('');
      setLoading(false);

      // If saved as draft, initiate logout
      if (saveAsDraft) {
        try {
          const logoutResponse = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session ? { 'X-Frappe-SID': session } : {}),
            },
            credentials: 'include', // Include cookies for session
          });
          const logoutData = await logoutResponse.json();
          console.log('Logout response:', logoutData);
          if (!logoutResponse.ok || logoutData.status === 'error') {
            throw new Error(logoutData.message || 'Failed to logout');
          }
          // Clear local storage or Redux state if needed
          localStorage.removeItem('email');
          localStorage.removeItem('company');
          // Redirect to login page or home
          navigate('/');
        } catch (logoutError) {
          setError(`Failed to logout: ${logoutError.message}. Please log out manually.`);
          console.error('Logout Error:', logoutError);
        }
      }
    } catch (err) {
      setError(`Failed to ${saveAsDraft ? 'save' : 'create'} POS Closing Entry: ${err.message}`);
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (error) return <div className="text-center mt-5 text-danger">Error: {error}</div>;

  return (
    <div className="container-fluid px-5 py-3">
      <h2 className="mb-4">Create POS Closing Entry</h2>
      {successMessage && (
        <div className="alert alert-success" role="alert">
          {successMessage}
        </div>
      )}
      {noInvoicesMessage && (
        <div className="alert alert-warning" role="alert">
          {noInvoicesMessage}
        </div>
      )}
      <div className="card p-4 mb-4">
        <div className="row mb-3">
          <div className="col-md-4">
            <label htmlFor="openingEntry" className="form-label">POS Opening Entry</label>
            <select
              id="openingEntry"
              className="form-select"
              value={selectedOpeningEntry}
              onChange={(e) => setSelectedOpeningEntry(e.target.value)}
            >
              <option value="">Select Opening Entry</option>
              {openingEntries.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {entry.name} ({entry.pos_profile}, {new Date(entry.period_start_date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label htmlFor="postingDate" className="form-label">Posting Date</label>
            <input
              type="datetime-local"
              id="postingDate"
              className="form-control"
              value={postingDate}
              onChange={(e) => setPostingDate(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <label htmlFor="periodEndDate" className="form-label">Period End Date & Time</label>
            <input
              type="datetime-local"
              id="periodEndDate"
              className="form-control"
              value={periodEndDate}
              onChange={(e) => setPeriodEndDate(e.target.value)}
            />
          </div>
        </div>

        {invoicesData && (
          <>
            <h4 className="mt-4">POS Invoices ({invoicesData.invoices.length})</h4>
            {/* ADDED: Wrap in table-responsive for scrollable overflow */}
            <div className="table-responsive">
              <table className="table table-striped table-bordered mb-4">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Posting Date</th>
                    <th>Net Total</th>
                    <th>Taxes</th>
                    <th>Grand Total</th>
                    <th>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesData.invoices.map((inv) => (
                    <tr key={inv.name}>
                      <td>{inv.name}</td>
                      <td>{inv.customer_name}</td>
                      <td>{new Date(inv.posting_date).toLocaleDateString()}</td>
                      <td>₹{inv.net_total.toFixed(2)}</td>
                      <td>₹{inv.total_taxes_and_charges.toFixed(2)}</td>
                      <td>₹{inv.grand_total.toFixed(2)}</td>
                      <td>
                        {inv.items.map((item) => (
                          <div key={item.item_code}>
                            {item.item_name} (Qty: {item.qty}, ₹{item.rate.toFixed(2)})
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4>Payment Reconciliation</h4>
            <table className="table table-bordered mb-4">
              <thead>
                <tr>
                  <th>Mode of Payment</th>
                  <th>Opening Amount</th>
                  <th>Expected Amount</th>
                  <th>Closing Amount</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {paymentReconciliation.map((pr, index) => (
                  <tr key={pr.mode_of_payment}>
                    <td>{pr.mode_of_payment}</td>
                    <td>₹{pr.opening_amount.toFixed(2)}</td>
                    <td>₹{pr.expected_amount.toFixed(2)}</td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={pr.closing_amount || ''}
                        onChange={(e) => handleClosingAmountChange(index, e.target.value)}
                        min="0"
                        step="0.01"
                        ref={(el) => (closingAmountRefs.current[index] = el)}
                        aria-label={`Closing Amount for ${pr.mode_of_payment}`}
                      />
                    </td>
                    <td>₹{pr.difference.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4>Taxes</h4>
            <table className="table table-bordered mb-4">
              <thead>
                <tr>
                  <th>Account Head</th>
                  <th>Rate (%)</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoicesData.taxes.map((tax) => (
                  <tr key={`${tax.account_head}:${tax.rate}`}>
                    <td>{tax.account_head}</td>
                    <td>{tax.rate.toFixed(2)}%</td>
                    <td>₹{tax.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="summary-section">
              <p><strong>Net Total:</strong> ₹{invoicesData.net_total.toFixed(2)}</p>
              <p><strong>Grand Total:</strong> ₹{invoicesData.grand_total.toFixed(2)}</p>
              <p><strong>Total Quantity:</strong> {invoicesData.total_quantity.toFixed(2)}</p>
            </div>
          </>
        )}

        <div className="d-flex justify-content-end mt-4 gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => handleSubmit(true)}
            disabled={loading || !invoicesData}
            aria-label="Save as Draft"
          >
            <i className="fas fa-save"></i> Save as Draft
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleSubmit(false)}
            disabled={loading || !invoicesData}
            aria-label="Create Closing Entry"
          >
            <i className="fas fa-save"></i> Create Closing Entry
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClosingEntry;