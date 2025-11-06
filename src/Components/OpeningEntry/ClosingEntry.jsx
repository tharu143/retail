import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Receipt, Calendar, CreditCard, TrendingUp, DollarSign } from 'lucide-react';

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
  const closingAmountRefs = useRef([]);

  const getCurrentISTDateTime = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset).toISOString().slice(0, 16);
  };

  const [postingDate, setPostingDate] = useState(getCurrentISTDateTime());
  const [periodEndDate, setPeriodEndDate] = useState(getCurrentISTDateTime());

  const getSession = () => localStorage.getItem('session') || '';

  useEffect(() => {
    const storedCompany = localStorage.getItem('company') || '';
    setCompany(storedCompany);
    if (!storedCompany) {
      setError('Company information missing. Please login again.');
    }
  }, []);

  useEffect(() => {
    const fetchOpeningEntries = async () => {
      try {
        setLoading(true);
        const session = getSession();
        const res = await fetch(
          '/api/resource/POS Opening Entry?filters=[["docstatus","=",1],["status","=","Open"]]&fields=["name","period_start_date","pos_profile","company","user"]',
          {
            headers: { 'X-Frappe-SID': session },
            credentials: 'include',
          }
        );
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
        setError(null);
        const session = getSession();
        const res = await fetch(
          '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pos_invoices_for_closing',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': session },
            credentials: 'include',
            body: JSON.stringify({ pos_opening_entry: selectedOpeningEntry, company }),
          }
        );
        const data = await res.json();
        let apiResponse = data;
        if (apiResponse.message && typeof apiResponse.message === 'object') {
          apiResponse = apiResponse.message;
        }
        if (!res.ok || apiResponse.status === 'error') {
          throw new Error(apiResponse.message || 'Failed to fetch invoices');
        }
        const payload = apiResponse.data || {};
        if (payload.invoices && payload.invoices.length > 0) {
          setInvoicesData(payload);
          setPaymentReconciliation(payload.payment_reconciliation || []);
          setNoInvoicesMessage('');
        } else {
          setInvoicesData(null);
          setPaymentReconciliation([]);
          setNoInvoicesMessage('No invoices found for the selected opening entry.');
        }
      } catch (err) {
        setError(`Failed to fetch invoices: ${err.message}`);
        setInvoicesData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [selectedOpeningEntry, company]);

  useEffect(() => {
    if (paymentReconciliation.length > 0 && closingAmountRefs.current[0]) {
      closingAmountRefs.current[0].focus();
    }
  }, [paymentReconciliation]);

  const handleClosingAmountChange = (index, value) => {
    const amt = parseFloat(value) || 0;
    if (amt < 0) {
      alert('Closing amount cannot be negative');
      return;
    }
    setPaymentReconciliation((prev) => {
      const updated = [...prev];
      updated[index].closing_amount = amt;
      updated[index].difference = flt(updated[index].expected_amount) - amt;
      return updated;
    });
  };

  const flt = (val) => Math.round((val || 0) * 100) / 100;

  const handleSubmit = async (saveAsDraft = false) => {
  if (!selectedOpeningEntry || !postingDate || !periodEndDate || !company) {
    alert('Please fill all required fields');
    return;
  }
  if (new Date(periodEndDate) < new Date(postingDate)) {
    alert('Period End Date cannot be before Posting Date');
    return;
  }
  if (!invoicesData) {
    alert('No invoice data available');
    return;
  }
  if (paymentReconciliation.some((p) => p.closing_amount === undefined)) {
    alert('Please enter closing amount for all payment modes');
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
    save_as_draft: saveAsDraft,
  };

  try {
    setLoading(true);
    setError(null);
    setSuccessMessage('');

    const session = getSession();
    const res = await fetch(
      '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_closing_entry',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': session },
        credentials: 'include',
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    let apiResponse = data;
    if (apiResponse.message && typeof apiResponse.message === 'object') {
      apiResponse = apiResponse.message;
    }

    if (!res.ok || apiResponse.status === 'error') {
      throw new Error(apiResponse.message || 'Failed to create closing entry');
    }

    const isDraft = saveAsDraft;
    const name = apiResponse.name || 'Unknown';
    const total = apiResponse.grand_total || invoicesData.grand_total || 0;

    setSuccessMessage(
      `POS Closing Entry ${isDraft ? 'saved as draft' : 'submitted'} successfully! Name: ${name}, Total: AED ${total.toFixed(2)}`
    );

    alert(`${isDraft ? 'Draft' : 'Closing Entry'} saved! Logging out...`);

    await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.user_logout', {
      method: 'POST',
      credentials: 'include',
    });

    localStorage.clear();
    window.location.href = '/';

  } catch (err) {
    setError(`Failed to submit: ${err.message}`);
  } finally {
    setLoading(false);
  }
};

  if (loading && openingEntries.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Receipt className="w-8 h-8 text-slate-700" />
            POS Closing Entry
          </h1>
          <p className="text-slate-600 mt-2">Complete your daily closing and reconcile payments</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-900 font-semibold">Error</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-green-900 font-semibold">Success</h3>
              <p className="text-green-700 text-sm mt-1">{successMessage}</p>
            </div>
          </div>
        )}

        {noInvoicesMessage && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800">{noInvoicesMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Entry Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                POS Opening Entry <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors bg-white text-slate-900"
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Posting Date <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors bg-white text-slate-900"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Period End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors bg-white text-slate-900"
                value={periodEndDate}
                onChange={(e) => setPeriodEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {invoicesData && (
          <>
            {/* Invoices Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Invoices
                </h2>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                  {invoicesData.invoices.length} {invoicesData.invoices.length === 1 ? 'Invoice' : 'Invoices'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Invoice</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Date</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Net Total</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Tax</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesData.invoices.map((inv, idx) => (
                      <tr key={inv.name} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="py-3 px-4 text-sm text-slate-900 font-medium">{inv.name}</td>
                        <td className="py-3 px-4 text-sm text-slate-700">{inv.customer_name}</td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          {new Date(inv.posting_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 text-right font-mono">
                          AED {flt(inv.net_total).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 text-right font-mono">
                          AED {flt(inv.total_taxes_and_charges).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 text-right font-semibold font-mono">
                          AED {flt(inv.grand_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Reconciliation */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Reconciliation
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Payment Mode</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Opening</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Expected</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Closing Amount</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentReconciliation.map((pr, idx) => (
                      <tr key={pr.mode_of_payment} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="py-3 px-4 text-sm text-slate-900 font-medium">{pr.mode_of_payment}</td>
                        <td className="py-3 px-4 text-sm text-slate-700 text-right font-mono">
                          AED {flt(pr.opening_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 text-right font-semibold font-mono">
                          AED {flt(pr.expected_amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-right font-mono text-sm"
                            value={pr.closing_amount || ''}
                            onChange={(e) => handleClosingAmountChange(idx, e.target.value)}
                            min="0"
                            step="0.01"
                            ref={(el) => (closingAmountRefs.current[idx] = el)}
                          />
                        </td>
                        <td className={`py-3 px-4 text-sm text-right font-semibold font-mono ${
                          pr.difference > 0 ? 'text-red-600' : pr.difference < 0 ? 'text-green-600' : 'text-slate-700'
                        }`}>
                          AED {flt(pr.difference).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tax Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tax Breakdown
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Account</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Rate</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesData.taxes.map((tax, idx) => (
                      <tr key={tax.account_head} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="py-3 px-4 text-sm text-slate-900">{tax.account_head}</td>
                        <td className="py-3 px-4 text-sm text-slate-700 text-right">{tax.rate}%</td>
                        <td className="py-3 px-4 text-sm text-slate-900 text-right font-semibold font-mono">
                          AED {flt(tax.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 mb-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="text-slate-300 text-sm mb-1">Net Total</p>
                  <p className="text-2xl font-bold text-white font-mono">AED {flt(invoicesData.net_total).toFixed(2)}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="text-slate-300 text-sm mb-1">Grand Total</p>
                  <p className="text-2xl font-bold text-white font-mono">AED {flt(invoicesData.grand_total).toFixed(2)}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <p className="text-slate-300 text-sm mb-1">Total Quantity</p>
                  <p className="text-2xl font-bold text-white font-mono">{flt(invoicesData.total_quantity).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-end">
          <button
            className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={() => handleSubmit(true)}
            disabled={loading || !invoicesData}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Save as Draft
          </button>
          <button
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={() => handleSubmit(false)}
            disabled={loading || !invoicesData}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {loading ? 'Processing...' : 'Create Closing Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClosingEntry;