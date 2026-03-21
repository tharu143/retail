import { useState, useEffect, useRef } from 'react';
import {
  AlertCircle, CheckCircle2, Loader2, Receipt, Calendar, CreditCard,
  TrendingUp, DollarSign, Palette, RefreshCw, FileText, ChevronDown
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { db } from '../../db';
import NavBar from '../Nav/NavBar';
import '../Admin/SalesOrder.css';

function ClosingEntry() {
  const currentUser = useSelector((state) => state.user.user);
  const currentPosProfile = useSelector((state) => state.user.posProfile);
  const reduxCompany = useSelector((state) => state.user.company);
  const [openingEntries, setOpeningEntries] = useState([]);
  const [selectedOpeningEntry, setSelectedOpeningEntry] = useState('');
  const [company, setCompany] = useState(reduxCompany || localStorage.getItem('company') || '');
  const [invoicesData, setInvoicesData] = useState(null);
  const [paymentReconciliation, setPaymentReconciliation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [noInvoicesMessage, setNoInvoicesMessage] = useState('');
  const [userRoles, setUserRoles] = useState([]);
  const closingAmountRefs = useRef([]);

  const getCurrentISTDateTime = () => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset).toISOString().slice(0, 16);
  };

  const [postingDate, setPostingDate] = useState(getCurrentISTDateTime());
  const [periodEndDate, setPeriodEndDate] = useState(getCurrentISTDateTime());

  // Theme support
  const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = polTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#ecfdf5' : '#f0f9ff';
  const themeHeaderBg = isGreen ? '#f2fdf9' : '#eff6ff';
  const themeHeaderText = isGreen ? '#0d9488' : '#1d4ed8';

  const getSession = () => localStorage.getItem('session') || '';

  useEffect(() => {
    const storedCompany = localStorage.getItem('company') || '';
    setCompany(storedCompany);
    if (!storedCompany) {
      setError('Company information missing. Please login again.');
    }

    const fetchUserRoles = async () => {
      if (!currentUser) return;
      try {
        const session = getSession();
        const res = await fetch(`/api/resource/User/${currentUser}?fields=["roles"]`, {
          headers: { 'X-Frappe-SID': session },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const roles = data.data?.roles?.map(r => r.role) || [];
          console.log("User Roles Debug:", roles); // Log roles to console for verification
          setUserRoles(roles);
        }
      } catch (err) {
        console.error("Failed to fetch roles:", err);
      }
    };
    fetchUserRoles();
  }, [currentUser]);

  useEffect(() => {
    const fetchOpeningEntries = async () => {
      if (!company) return; // Wait for company to be available
      try {
        setLoading(true);
        if (!navigator.onLine) {
          const offlineOpening = await db.opening_entries.where('is_synced').equals(0).toArray();
          const syncedOpening = await db.opening_entries.where('is_synced').equals(1).toArray(); // We might need previously synced ones too

          // Fallback: If we are offline, we only show what we have in Dexie
          setOpeningEntries(offlineOpening.map(e => ({
            name: e.offline_id,
            period_start_date: e.period_start_date,
            pos_profile: e.pos_profile,
            company: e.company,
            user: e.user
          })));
          return;
        }
        const session = getSession();
        const filters = [
          ["docstatus", "=", 1],
          ["status", "=", "Open"],
          ["company", "=", company]
        ];

        if (currentUser) {
          filters.push(["user", "=", currentUser]);
        }
        if (currentPosProfile) {
          filters.push(["pos_profile", "=", currentPosProfile]);
        }

        const res = await fetch(
          `/api/resource/POS Opening Entry?filters=${JSON.stringify(filters)}&fields=["name","period_start_date","pos_profile","company","user"]`,
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
  }, [company, currentUser, currentPosProfile]);

  useEffect(() => {
    localStorage.setItem('legacySubTheme', polTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [polTheme, themeColor, themeColorHover, themeLight]);

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

        let payload = {};

        if (!navigator.onLine) {
          // Fetch invoices from Dexie for this opening entry
          const offlineInvoices = await db.invoices
            .where('pos_opening_entry').equals(selectedOpeningEntry)
            .toArray();

          if (offlineInvoices.length === 0) {
            setInvoicesData(null);
            setPaymentReconciliation([]);
            setNoInvoicesMessage('No offline invoices found for this shift.');
            return;
          }

          // Construct a payload similar to what the server returns
          payload = {
            invoices: offlineInvoices.map(inv => ({
              name: inv.offline_id,
              customer_name: inv.customer,
              posting_date: inv.posting_date,
              net_total: inv.grand_total / 1.05, // Approximation for offline
              total_taxes_and_charges: inv.grand_total - (inv.grand_total / 1.05),
              grand_total: inv.grand_total,
              payments: inv.payments
            })),
            pos_transactions: offlineInvoices.map(inv => ({
              offline_id: inv.offline_id
            })),
            payment_reconciliation: [], // We will build this below
            taxes: [], // We will build this below
            grand_total: offlineInvoices.reduce((sum, inv) => sum + inv.grand_total, 0),
            net_total: offlineInvoices.reduce((sum, inv) => sum + (inv.grand_total / 1.05), 0),
            total_quantity: offlineInvoices.reduce((sum, inv) => sum + inv.items.reduce((s, it) => s + it.quantity, 0), 0)
          };

          // Get modes of payment from Opening Entry
          const openingEntry = await db.opening_entries.where('offline_id').equals(selectedOpeningEntry).first();
          if (openingEntry && openingEntry.balance_details) {
            payload.payment_reconciliation = openingEntry.balance_details.map(bd => ({
              mode_of_payment: bd.mode_of_payment,
              opening_amount: parseFloat(bd.opening_amount) || 0,
              expected_amount: 0,
              closing_amount: 0
            }));
          }

        } else {
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
          payload = apiResponse.data || {};
        }

        if (payload.invoices && payload.invoices.length > 0) {
          setInvoicesData(payload);

          // Compute paid_amount per mode from invoices payments
          const paidAmounts = {};
          payload.invoices.forEach(inv => {
            if (inv.payments && Array.isArray(inv.payments)) {
              inv.payments.forEach(pay => {
                const mode = pay.mode_of_payment;
                if (mode) {
                  paidAmounts[mode] = (paidAmounts[mode] || 0) + flt(pay.amount || 0);
                }
              });
            }
          });

          // Fix reconciliation: expected_amount = opening + paid from invoices
          const fixedReconciliation = (payload.payment_reconciliation || []).map(pr => {
            const expected = flt(pr.opening_amount + (paidAmounts[pr.mode_of_payment] || 0));
            return {
              ...pr,
              paid_amount: paidAmounts[pr.mode_of_payment] || 0,
              expected_amount: expected,
              closing_amount: expected,
              difference: 0
            };
          });
          setPaymentReconciliation(fixedReconciliation);
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
    if (invoicesData && paymentReconciliation.length > 0 && closingAmountRefs.current[0]) {
      // Use a small timeout to ensure DOM is ready
      setTimeout(() => {
        closingAmountRefs.current[0]?.focus();
      }, 100);
    }
  }, [invoicesData]); // Only focus when new data is first loaded, NOT on every keystroke

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

      if (!navigator.onLine) {
        const dummyId = `OFFLINE-CLOSE-${new Date().getTime()}`;
        const offlineClosing = {
          ...payload,
          offline_id: dummyId,
          is_synced: 0,
          timestamp: new Date().toISOString()
        };
        await db.closing_entries.add(offlineClosing);

        alert(`Offline Closing Entry saved! It will be synced automatically when online. Logging out...`);
        localStorage.clear();
        window.location.hash = '/'; // Using hash router
        return;
      }

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

      let sysError = apiResponse.message;
      if (!sysError && data._server_messages) {
        try {
          const msgs = JSON.parse(data._server_messages);
          const latest = JSON.parse(msgs[msgs.length - 1]);
          if (latest && latest.message) sysError = latest.message;
        } catch (e) { } // Ignore parse failures
      }

      if (!res.ok || apiResponse.status === 'error') {
        const fallbackMsg = `Failed to create closing entry. Server returned HTTP ${res.status}`;
        throw new Error(sysError || (typeof apiResponse === 'string' ? apiResponse : fallbackMsg));
      }

      const isDraft = saveAsDraft;
      const name = apiResponse.name || 'Unknown';
      const total = apiResponse.grand_total || invoicesData.grand_total || 0;

      if (isDraft) {
        setSuccessMessage("Shift data saved successfully! An Admin will perform the final closing.");
        alert("Shift data saved successfully! An Admin will perform the final closing. Logging out...");
      } else {
        setSuccessMessage(
          `POS Closing Entry submitted successfully! Name: ${name}, Total: AED ${total.toFixed(2)}`
        );
        alert(`POS Closing Entry submitted successfully! Logging out...`);
      }

      // Use standard Frappe logout instead of non-existent retail_api logout
      await fetch('/api/method/logout', {
        method: 'POST',
        credentials: 'include',
      });

      localStorage.clear();
      window.location.hash = '/';

    } catch (err) {
      let msg = err.message;
      setError(`Failed to submit: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && openingEntries.length === 0) {
    return (
      <div className="so-page" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="text-lg font-medium">Loading session list...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="so-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <NavBar />

      <style>{`
        .ce-scroll-area {
            flex: 1;
            overflow-y: auto;
            padding: 1.25rem 1.5rem;
            background: #f8fafc;
        }
        .ce-summary-card {
            background: linear-gradient(135deg, ${isGreen ? '#064e3b' : '#0c4a6e'} 0%, ${isGreen ? '#065f46' : '#075985'} 100%);
            border-radius: 1rem;
            padding: 1.5rem;
            color: white;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .ce-stat-value {
            font-size: 1.875rem;
            font-weight: 800;
            font-family: 'JetBrains Mono', monospace;
        }
        .ce-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
      `}</style>

      <div className="so-page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="so-page-title">
            <Receipt size={22} />
            POS Closing Entry
          </h1>
          <p className="so-page-subtitle">Reconcile shift payments and finalize daily sales</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', background: themeHeaderBg,
              border: `1.5px solid ${themeColor}`, borderRadius: '0.5rem',
              fontSize: '0.7rem', fontWeight: 700, color: themeHeaderText,
              cursor: 'pointer', transition: 'all 0.2s',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}
          >
            <Palette size={14} />
            {polTheme}
          </button>

          <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>

          {/* Action Buttons in Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {userRoles.includes('Administrator') || userRoles.includes('System Manager') ? (
              <>
                <button
                  className="so-btn-ghost"
                  style={{ background: '#f1f5f9', fontSize: '0.7rem', padding: '0.55rem 1rem', height: '38px' }}
                  onClick={() => handleSubmit(true)}
                  disabled={loading || !invoicesData}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Save Draft
                </button>
                <button
                  className="so-btn-primary"
                  style={{ height: '38px', padding: '0 1.25rem', fontSize: '0.75rem', background: '#0f172a' }}
                  onClick={() => handleSubmit(false)}
                  disabled={loading || !invoicesData}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {loading ? 'Processing...' : 'Finalize & Submit Shift'}
                </button>
              </>
            ) : (
              <button
                className="so-btn-primary"
                style={{ height: '38px', padding: '0 1.5rem', fontSize: '0.75rem' }}
                onClick={() => handleSubmit(true)}
                disabled={loading || !invoicesData}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {loading ? 'Processing...' : 'Save Shift as Draft'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE CONTENT */}
      <div className="ce-scroll-area">
        <div style={{ width: '100%' }}>
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in duration-300">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-900 font-semibold text-sm caps">System Error</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3 animate-in zoom-in duration-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-emerald-900 font-semibold text-sm">Operation Success</h3>
                <p className="text-emerald-700 text-sm mt-1">{successMessage}</p>
              </div>
            </div>
          )}

          {noInvoicesMessage && (
            <div className="so-card" style={{ borderLeft: `4px solid #f59e0b`, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <p className="text-slate-700 font-medium text-sm">{noInvoicesMessage}</p>
              </div>
            </div>
          )}

          {/* Session Selector Card */}
          <div className="so-card" style={{ marginBottom: '1.5rem' }}>
            <div className="so-card-header">
              <span className="so-card-title flex items-center gap-2">
                <Calendar size={16} style={{ color: themeColor }} />
                Shift Details
              </span>
            </div>
            <div className="so-card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="so-label">POS Opening Entry <span className="text-red-500">*</span></label>
                  <div className="so-relative">
                    <select
                      className="so-select"
                      value={selectedOpeningEntry}
                      onChange={(e) => setSelectedOpeningEntry(e.target.value)}
                    >
                      <option value="">Select Opening Entry</option>
                      {openingEntries.map((entry) => (
                        <option key={entry.name} value={entry.name}>
                          {entry.name} — {entry.pos_profile}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                  </div>
                </div>
                <div>
                  <label className="so-label">Posting Date</label>
                  <input
                    type="datetime-local"
                    className="so-input"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="so-label">Period End Date</label>
                  <input
                    type="datetime-local"
                    className="so-input"
                    value={periodEndDate}
                    onChange={(e) => setPeriodEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {invoicesData && (
            <>
              {/* Summary Dashboard Section */}
              <div className="ce-grid">
                <div className="ce-summary-card">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-white/20 rounded-lg"><DollarSign size={20} /></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/70">Grand Total</span>
                  </div>
                  <div className="ce-stat-value">AED {flt(invoicesData.grand_total).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</div>
                  <div className="mt-2 text-sm text-white/80 flex items-center gap-1">
                    <TrendingUp size={14} /> Total collected across all modes
                  </div>
                </div>

                <div className="ce-summary-card" style={{ background: `linear-gradient(135deg, #1e293b 0%, #334155 100%)` }}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-white/10 rounded-lg"><Receipt size={20} /></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/60">Invoice Count</span>
                  </div>
                  <div className="ce-stat-value">{invoicesData.invoices.length}</div>
                  <div className="mt-2 text-sm text-white/50">Successful transactions in this shift</div>
                </div>

                <div className="ce-summary-card" style={{ background: `linear-gradient(135deg, ${isGreen ? '#065f46' : '#075985'} 0%, ${isGreen ? '#10b981' : '#0ea5e9'} 100%)` }}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-white/20 rounded-lg"><FileText size={20} /></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-white/70">Quantity</span>
                  </div>
                  <div className="ce-stat-value">{flt(invoicesData.total_quantity).toFixed(0)}</div>
                  <div className="mt-2 text-sm text-white/80 font-medium">Items moved during session</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Reconciliation Table */}
                <div className="so-card">
                  <div className="so-card-header">
                    <span className="so-card-title flex items-center gap-2">
                      <CreditCard size={16} /> Payment Reconciliation
                    </span>
                  </div>
                  <div className="so-items-table-wrap">
                    <table className="so-items-table">
                      <thead>
                        <tr>
                          <th>Payment Mode</th>
                          <th style={{ textAlign: 'right' }}>Expected</th>
                          <th style={{ textAlign: 'right', width: '30%' }}>Closing Amount</th>
                          <th style={{ textAlign: 'right' }}>Diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentReconciliation.map((pr, idx) => (
                          <tr key={pr.mode_of_payment}>
                            <td style={{ fontWeight: 600 }}>{pr.mode_of_payment}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{flt(pr.expected_amount).toFixed(2)}</td>
                            <td>
                              <input
                                type="number"
                                className="so-td-input"
                                style={{ textAlign: 'right', fontStyle: 'normal', fontWeight: 800 }}
                                value={pr.closing_amount || ''}
                                onChange={(e) => handleClosingAmountChange(idx, e.target.value)}
                                ref={(el) => (closingAmountRefs.current[idx] = el)}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: pr.difference > 0 ? '#ef4444' : pr.difference < 0 ? '#10b981' : '#64748b' }}>
                              {flt(pr.difference).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tax Breakdown Card */}
                <div className="so-card">
                  <div className="so-card-header">
                    <span className="so-card-title flex items-center gap-2">
                      <TrendingUp size={16} /> Tax Statistics
                    </span>
                  </div>
                  <div className="so-items-table-wrap">
                    <table className="so-items-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th style={{ textAlign: 'right' }}>Rate</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicesData.taxes.map((tax) => (
                          <tr key={tax.account_head}>
                            <td style={{ fontSize: '0.75rem' }}>{tax.account_head}</td>
                            <td style={{ textAlign: 'right' }}>{tax.rate}%</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>AED {flt(tax.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Invoices List Card - Compact */}
              <div className="so-card">
                <div className="so-card-header" style={{ background: '#f8fafc' }}>
                  <span className="so-card-title flex items-center gap-2">
                    <Receipt size={16} /> Shift Transaction Log
                  </span>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="so-table">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f2fdf9' }}>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th style={{ textAlign: 'right' }}>Grand Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesData.invoices.map((inv) => (
                        <tr key={inv.name}>
                          <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{inv.name}</td>
                          <td>{inv.customer_name}</td>
                          <td>{new Date(inv.posting_date).toLocaleDateString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>AED {flt(inv.grand_total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Footer removed, actions moved to header */}
          <div className="mb-20"></div>
        </div>
      </div>
    </div>
  );
}

export default ClosingEntry;
