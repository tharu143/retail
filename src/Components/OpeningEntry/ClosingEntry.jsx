// src/components/ClosingEntry/ClosingEntry.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../Redux/Slices/userSlice';
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
  const dispatch = useDispatch();
  const userData = useSelector((state) => state.user);
  const closingAmountRefs = useRef([]);

  // IST DateTime
  const getCurrentISTDateTime = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset).toISOString().slice(0, 16);
  };

  const [postingDate, setPostingDate] = useState(getCurrentISTDateTime());
  const [periodEndDate, setPeriodEndDate] = useState(getCurrentISTDateTime());

  // Session
  const getSession = () => localStorage.getItem('session') || userData?.session || '';

  // === INIT COMPANY ===
  useEffect(() => {
    const reduxCompany = userData?.company || localStorage.getItem('company') || '';
    setCompany(reduxCompany);
    if (!reduxCompany) setError('Company missing. Please login again.');
  }, [userData]);

  // === FETCH OPENING ENTRIES ===
  useEffect(() => {
    const fetchOpeningEntries = async () => {
      try {
        setLoading(true);
        const session = getSession();
        const res = await fetch('/api/resource/POS Opening Entry?filters=[["docstatus","=",1],["status","=","Open"]]&fields=["name","period_start_date","pos_profile","company","user"]', {
          headers: { 'X-Frappe-SID': session },
          credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOpeningEntries(data.data || []);
      } catch (err) {
        setError(`Failed to load opening entries: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchOpeningEntries();
  }, []);

  // === FETCH INVOICES ===
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!selectedOpeningEntry || !company) {
        setInvoicesData(null);
        setPaymentReconciliation([]);
        setNoInvoicesMessage('');
        return;
      }

      try {
        setLoading(true);
        const session = getSession();
        const res = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_invoices_for_closing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': session },
          credentials: 'include',
          body: JSON.stringify({ pos_opening_entry: selectedOpeningEntry, company })
        });

        const data = await res.json();
        console.log("Raw Invoices Response:", data);

        // === CORRECT PARSING ===
        let apiResponse = data;
        if (apiResponse.message && typeof apiResponse.message === 'object') {
          apiResponse = apiResponse.message;
        }

        if (!res.ok || apiResponse.status === 'error') {
          throw new Error(apiResponse.message || 'Failed');
        }

        const payload = apiResponse.data || {};
        if (payload.invoices?.length > 0) {
          setInvoicesData(payload);
          setPaymentReconciliation(payload.payment_reconciliation || []);
          setNoInvoicesMessage('');
        } else {
          setInvoicesData(null);
          setPaymentReconciliation([]);
          setNoInvoicesMessage('No invoices found.');
        }
      } catch (err) {
        setError(`Failed: ${err.message}`);
        setInvoicesData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [selectedOpeningEntry, company]);

  // === AUTO FOCUS ===
  useEffect(() => {
    if (paymentReconciliation.length > 0 && closingAmountRefs.current[0]) {
      closingAmountRefs.current[0].focus();
    }
  }, [paymentReconciliation]);

  // === HANDLE CLOSING AMOUNT ===
  const handleClosingAmountChange = (index, value) => {
    const amt = parseFloat(value) || 0;
    if (amt < 0) {
      alert('Cannot be negative');
      return;
    }
    setPaymentReconciliation(prev => {
      const updated = [...prev];
      updated[index].closing_amount = amt;
      updated[index].difference = flt(updated[index].expected_amount) - amt;
      return updated;
    });
  };

  const flt = (val) => Math.round((val || 0) * 100) / 100;

  // === SUBMIT ===
  const handleSubmit = async (saveAsDraft = false) => {
    if (!selectedOpeningEntry || !postingDate || !periodEndDate || !company) {
      alert('Fill all required fields');
      return;
    }
    if (new Date(periodEndDate) < new Date(postingDate)) {
      alert('Period End Date cannot be before Posting Date');
      return;
    }
    if (!invoicesData) {
      alert('No invoice data');
      return;
    }
    if (paymentReconciliation.some(p => p.closing_amount === undefined)) {
      alert('Enter closing amount');
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
      company,
      save_as_draft: saveAsDraft
    };

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');

      const session = getSession();
      const res = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_closing_entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': session },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      console.log("Create Closing Response:", data);

      // === CORRECT PARSING ===
      let apiResponse = data;
      if (apiResponse.message && typeof apiResponse.message === 'object') {
        apiResponse = apiResponse.message;
      }

      if (!res.ok || apiResponse.status === 'error') {
        throw new Error(apiResponse.message || 'Failed');
      }

      // === SUCCESS ===
      const isDraft = saveAsDraft;
      const name = apiResponse.name || 'Unknown';
      const total = apiResponse.grand_total || invoicesData.grand_total || 0;

      setSuccessMessage(
        `POS Closing Entry ${isDraft ? 'saved as draft' : 'submitted'} successfully! ` +
        `Name: ${name}, Total: ₹${total.toFixed(2)}`
      );

      // === DRAFT: LOGOUT ===
      if (isDraft) {
        localStorage.removeItem("posOpeningEntry");
        alert("Draft saved! Logging out...");
        await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_logout', { method: 'POST', credentials: 'include' });
        localStorage.clear();
        dispatch(logout());
        navigate('/');
        return;
      }

      // === SUBMITTED: RESET ===
      setInvoicesData(null);
      setSelectedOpeningEntry('');
      setPaymentReconciliation([]);
      localStorage.removeItem("posOpeningEntry");

    } catch (err) {
      setError(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // === RENDER ===
  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (error) return <div className="text-center mt-5 text-danger">Error: {error}</div>;

  return (
    <div className="container-fluid px-5 py-3">
      <h2 className="mb-4">Create POS Closing Entry</h2>

      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {noInvoicesMessage && <div className="alert alert-warning">{noInvoicesMessage}</div>}

      <div className="card p-4 mb-4">
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">POS Opening Entry *</label>
            <select className="form-select" value={selectedOpeningEntry} onChange={e => setSelectedOpeningEntry(e.target.value)}>
              <option value="">Select</option>
              {openingEntries.map(e => (
                <option key={e.name} value={e.name}>
                  {e.name} ({e.pos_profile}, {new Date(e.period_start_date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Posting Date *</label>
            <input type="datetime-local" className="form-control" value={postingDate} onChange={e => setPostingDate(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Period End Date *</label>
            <input type="datetime-local" className="form-control" value={periodEndDate} onChange={e => setPeriodEndDate(e.target.value)} />
          </div>
        </div>

        {invoicesData && (
          <>
            <h4 className="mt-4">Invoices ({invoicesData.invoices.length})</h4>
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Net</th><th>Tax</th><th>Total</th></tr></thead>
                <tbody>
                  {invoicesData.invoices.map(inv => (
                    <tr key={inv.name}>
                      <td>{inv.name}</td>
                      <td>{inv.customer_name}</td>
                      <td>{new Date(inv.posting_date).toLocaleDateString()}</td>
                      <td>₹{flt(inv.net_total).toFixed(2)}</td>
                      <td>₹{flt(inv.total_taxes_and_charges).toFixed(2)}</td>
                      <td>₹{flt(inv.grand_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4>Payment Reconciliation</h4>
            <table className="table table-bordered">
              <thead><tr><th>Mode</th><th>Opening</th><th>Expected</th><th>Closing</th><th>Difference</th></tr></thead>
              <tbody>
                {paymentReconciliation.map((pr, i) => (
                  <tr key={pr.mode_of_payment}>
                    <td>{pr.mode_of_payment}</td>
                    <td>₹{flt(pr.opening_amount).toFixed(2)}</td>
                    <td>₹{flt(pr.expected_amount).toFixed(2)}</td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={pr.closing_amount || ''}
                        onChange={e => handleClosingAmountChange(i, e.target.value)}
                        min="0"
                        step="0.01"
                        ref={el => closingAmountRefs.current[i] = el}
                      />
                    </td>
                    <td>₹{flt(pr.difference).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4>Taxes</h4>
            <table className="table table-bordered mb-4">
              <thead><tr><th>Account</th><th>Rate</th><th>Amount</th></tr></thead>
              <tbody>
                {invoicesData.taxes.map(t => (
                  <tr key={t.account_head}>
                    <td>{t.account_head}</td>
                    <td>{t.rate}%</td>
                    <td>₹{flt(t.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="summary-section p-3 bg-light rounded">
              <p><strong>Net Total:</strong> ₹{flt(invoicesData.net_total).toFixed(2)}</p>
              <p><strong>Grand Total:</strong> ₹{flt(invoicesData.grand_total).toFixed(2)}</p>
              <p><strong>Total Qty:</strong> {flt(invoicesData.total_quantity).toFixed(2)}</p>
            </div>
          </>
        )}

        <div className="d-flex justify-content-end mt-4 gap-3">
          <button className="btn btn-secondary px-4" onClick={() => handleSubmit(true)} disabled={loading || !invoicesData}>
            Save as Draft
          </button>
          <button className="btn btn-primary px-4" onClick={() => handleSubmit(false)} disabled={loading || !invoicesData}>
            {loading ? 'Processing...' : 'Create Closing Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClosingEntry;