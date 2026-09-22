import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, Loader2, Receipt, Calendar, CreditCard,
  TrendingUp, DollarSign, Palette, RefreshCw, FileText, ChevronDown, User, Building2, X, Printer, LogOut,
  ArrowRightLeft, Truck, AlertTriangle, HandCoins, Wallet, Store, Banknote, Coins, ArrowLeft
} from 'lucide-react';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { useSelector } from 'react-redux';
import { db } from '../../db';
import { frappeCall } from '../../utils/frappe';
import '../Admin/SalesOrder.css';
import '../Reports/DailySalesReport.css';
import './ClosingEntry.css';
import './OpeningEntryDetail.css';

const UAE_DENOMINATIONS = [
  { value: 1000, label: '1000 AED (Note)' },
  { value: 500, label: '500 AED (Note)' },
  { value: 200, label: '200 AED (Note)' },
  { value: 100, label: '100 AED (Note)' },
  { value: 50, label: '50 AED (Note)' },
  { value: 20, label: '20 AED (Note)' },
  { value: 10, label: '10 AED (Note)' },
  { value: 5, label: '5 AED (Note)' },
  { value: 1, label: '1 AED (Coin)' },
  { value: 0.50, label: '0.50 AED (Coin)' },
  { value: 0.25, label: '0.25 AED (Coin)' }
];

function ClosingEntry() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const currentUser = useSelector((state) => state.user.user);
  const currentPosProfile = useSelector((state) => state.user.posProfile);
  const reduxCompany = useSelector((state) => state.user.company);
  const [openingEntries, setOpeningEntries] = useState([]);
  const [selectedOpeningEntry, setSelectedOpeningEntry] = useState('');
  const [company, setCompany] = useState(reduxCompany || localStorage.getItem('company') || '');
  const [closingDetailData, setClosingDetailData] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [invoicesData, setInvoicesData] = useState(null);
  const [paymentReconciliation, setPaymentReconciliation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [noInvoicesMessage, setNoInvoicesMessage] = useState('');
  const [userRoles, setUserRoles] = useState([]);
  const closingAmountRefs = useRef([]);

  // Denominations count
  const [denomCounts, setDenomCounts] = useState(
    UAE_DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.value]: 0 }), {})
  );
  const [discrepancyReason, setDiscrepancyReason] = useState('');

  // Thermal Slip Modal & Data
  const [showThermalModal, setShowThermalModal] = useState(false);
  const [thermalData, setThermalData] = useState(null);

  const handlePrintThermalSlip = () => {
    const thermalElement = document.getElementById('closing-shift-thermal-slip');
    if (!thermalElement) return;

    const printWindow = window.open('', '_blank', 'width=380,height=650');
    if (!printWindow) {
      alert('Please allow popups to print thermal slip');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>POS Shift Closing Slip</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
            background: #fff;
            padding: 10px 8px;
            margin: 0;
            line-height: 1.35;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-black { font-weight: 900; }
          .thermal-top-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; margin-bottom: 2px; }
          .thermal-sub-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 4px; }
          .thermal-dotted-sep { border-top: 1px dotted #000; margin: 5px 0; }
          .thermal-line-sep { border-top: 1px solid #000; margin: 5px 0; }
          .thermal-row-3col { display: flex; align-items: center; justify-content: space-between; margin: 3px 0; font-size: 12px; }
          .col-title { flex: 2; text-align: left; }
          .col-qty { flex: 0.8; text-align: right; padding-right: 14px; }
          .col-val { flex: 1.2; text-align: right; font-weight: 600; }
          .total-highlight { font-size: 13.5px; font-weight: 900; }
        </style>
      </head>
      <body>
        ${thermalElement.innerHTML}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleFinalLogout = async () => {
    try {
      await fetch('/api/method/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.warn('Logout request failed:', e);
    }
    localStorage.clear();
    window.location.hash = '/';
  };

  useEffect(() => {
    if (routeId) {
      setIsReadOnly(true);
      const fetchDetail = async () => {
        try {
          setLoading(true);
          const res = await frappeCall({
            method: 'kyle_retail.retail_api.api.get_closing_entry_details',
            args: { name: routeId },
            type: 'POST'
          });
          if (res?.status === 'success' && res.data) {
            setClosingDetailData(res.data);
          } else {
            setError(res?.message || 'Failed to fetch closing entry details');
          }
        } catch (err) {
          setError(err.message || 'Error fetching closing entry details');
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    }
  }, [routeId]);
  
  // Telephone Machine Balance state
  const [telephoneBalance, setTelephoneBalance] = useState('');
  const [telephoneCash, setTelephoneCash] = useState('');

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
          console.log("User Roles Debug:", roles);
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
      if (!company) return;
      try {
        setLoading(true);
        if (!navigator.onLine) {
          const offlineOpening = await db.opening_entries.where('is_synced').equals(0).toArray();
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

  // Pending Inter-Branch MR / MT Requests Notification State
  const [pendingBranchReqs, setPendingBranchReqs] = useState({
    has_pending: false,
    pending_mr_count: 0,
    pending_mt_count: 0,
    pending_mr: [],
    pending_mt: []
  });

  useEffect(() => {
    const fetchPendingBranchReqs = async () => {
      try {
        const session = getSession();
        const warehouse = localStorage.getItem('warehouse');
        const posProfile = currentPosProfile || localStorage.getItem('pos_profile');
        const params = new URLSearchParams();
        if (warehouse) params.append('warehouse', warehouse);
        if (posProfile) params.append('pos_profile', posProfile);

        const res = await fetch(`/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_pending_branch_requests?${params.toString()}`, {
          headers: { 'X-Frappe-SID': session },
          credentials: 'include'
        });
        if (res.ok) {
          const json = await res.json();
          const result = json.message || json;
          if (result.status === 'success') {
            setPendingBranchReqs(result);
          }
        }
      } catch (e) {
        console.warn('Could not fetch pending branch requests:', e);
      }
    };
    fetchPendingBranchReqs();
  }, [currentPosProfile]);

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
          const offlineInvoices = await db.invoices
            .where('pos_opening_entry').equals(selectedOpeningEntry)
            .toArray();

          if (offlineInvoices.length === 0) {
            setInvoicesData(null);
            setPaymentReconciliation([]);
            setNoInvoicesMessage('No offline invoices found for this shift.');
            return;
          }

          payload = {
            invoices: offlineInvoices.map(inv => ({
              name: inv.offline_id,
              customer_name: inv.customer,
              posting_date: inv.posting_date,
              net_total: inv.grand_total / 1.05,
              total_taxes_and_charges: inv.grand_total - (inv.grand_total / 1.05),
              grand_total: inv.grand_total,
              payments: inv.payments
            })),
            pos_transactions: offlineInvoices.map(inv => ({
              offline_id: inv.offline_id
            })),
            payment_reconciliation: [],
            taxes: [],
            grand_total: offlineInvoices.reduce((sum, inv) => sum + inv.grand_total, 0),
            net_total: offlineInvoices.reduce((sum, inv) => sum + (inv.grand_total / 1.05), 0),
            total_quantity: offlineInvoices.reduce((sum, inv) => sum + inv.items.reduce((s, it) => s + it.quantity, 0), 0)
          };

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

        // Allow closing even if 0 invoices exist during the shift
        if (payload) {
          const invoicesList = payload.invoices || [];
          setInvoicesData({
            ...payload,
            invoices: invoicesList,
            pos_transactions: payload.pos_transactions || [],
            grand_total: payload.grand_total || 0,
            net_total: payload.net_total || 0,
            total_quantity: payload.total_quantity || 0,
            taxes: payload.taxes || []
          });

          const paidAmounts = {};
          invoicesList.forEach(inv => {
            if (inv.payments && Array.isArray(inv.payments)) {
              inv.payments.forEach(pay => {
                const mode = pay.mode_of_payment;
                if (mode) {
                  paidAmounts[mode] = (paidAmounts[mode] || 0) + flt(pay.amount || 0);
                }
              });
            }
          });

          const fixedReconciliation = (payload.payment_reconciliation || []).map(pr => {
            const paidSales = paidAmounts[pr.mode_of_payment] !== undefined ? paidAmounts[pr.mode_of_payment] : flt(pr.paid_amount || 0);
            const handover = flt(pr.collected_handover || 0);
            const expected = pr.expected_amount !== undefined ? flt(pr.expected_amount) : Math.max(0, flt(pr.opening_amount + paidSales - (pr.mode_of_payment === 'Cash' ? handover : 0)));
            return {
              ...pr,
              paid_amount: paidSales,
              collected_handover: handover,
              expected_amount: expected,
              closing_amount: pr.mode_of_payment === 'Cash' ? 0.0 : expected,
              difference: pr.mode_of_payment === 'Cash' ? expected : 0
            };
          });
          setPaymentReconciliation(fixedReconciliation);
          if (invoicesList.length === 0) {
            setNoInvoicesMessage('No sales invoices created during this shift. You can count cash, enter telephone machine balance, and close the shift.');
          } else {
            setNoInvoicesMessage('');
          }
          // Reset denomination counts
          setDenomCounts(UAE_DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.value]: 0 }), {}));
          setDiscrepancyReason('');
        } else {
          setInvoicesData(null);
          setPaymentReconciliation([]);
          setNoInvoicesMessage('No shift data found for the selected opening entry.');
        }
      } catch (err) {
        setError(`Failed to fetch shift details: ${err.message}`);
        setInvoicesData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [selectedOpeningEntry, company]);



  useEffect(() => {
    if (invoicesData && paymentReconciliation.length > 0 && closingAmountRefs.current[0]) {
      setTimeout(() => {
        closingAmountRefs.current[0]?.focus();
      }, 100);
    }
  }, [invoicesData]);

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

  const handleDenomChange = (val, countStr) => {
    const count = parseInt(countStr) || 0;
    const newCounts = { ...denomCounts, [val]: count };
    setDenomCounts(newCounts);

    const totalCash = Object.keys(newCounts).reduce((sum, k) => {
      return sum + (parseFloat(k) * (newCounts[k] || 0));
    }, 0);

    setPaymentReconciliation((prev) => {
      return prev.map((pr) => {
        if (pr.mode_of_payment === 'Cash') {
          const expected = flt(pr.expected_amount);
          const diff = expected - totalCash;
          return {
            ...pr,
            closing_amount: totalCash,
            difference: diff
          };
        }
        return pr;
      });
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

    const cashReconciliation = paymentReconciliation.find(p => p.mode_of_payment === 'Cash');
    if (cashReconciliation && flt(cashReconciliation.difference) !== 0 && !discrepancyReason.trim()) {
      alert('A discrepancy reason is required when counted cash does not match expected cash.');
      return;
    }

    if (telephoneBalance === '' || telephoneBalance === null || telephoneBalance === undefined) {
      alert('Please enter Telephone Machine Balance (AED). It is required.');
      return;
    }

    if (telephoneCash === '' || telephoneCash === null || telephoneCash === undefined) {
      alert('Please enter Telephone Machine Cash (AED). It is required.');
      return;
    }

    if (pendingBranchReqs.has_pending) {
      const confirmProceed = window.confirm(
        `⚠️ WARNING: This branch currently has ${pendingBranchReqs.pending_mr_count} pending Material Request(s) (MR) and ${pendingBranchReqs.pending_mt_count} in-transit/draft Stock Transfer(s) (MT).\n\nDo you want to proceed with closing this shift anyway?`
      );
      if (!confirmProceed) return;
    }

    const formattedClosingDenoms = Object.keys(denomCounts)
      .filter((k) => (denomCounts[k] || 0) > 0)
      .map((k) => ({
        denomination: parseFloat(k),
        count: parseInt(denomCounts[k]) || 0,
        amount: parseFloat(k) * (parseInt(denomCounts[k]) || 0)
      }));

    const payload = {
      pos_opening_entry: selectedOpeningEntry,
      posting_date: postingDate,
      period_end_date: periodEndDate,
      pos_transactions: JSON.stringify(invoicesData.pos_transactions || []),
      payment_reconciliation: JSON.stringify(paymentReconciliation),
      taxes: JSON.stringify(invoicesData.taxes || []),
      grand_total: flt(invoicesData.grand_total),
      net_total: flt(invoicesData.net_total),
      total_quantity: flt(invoicesData.total_quantity),
      company,
      save_as_draft: saveAsDraft,
      closing_denominations: JSON.stringify(formattedClosingDenoms),
      discrepancy_reason: discrepancyReason,
      telephone_balance: telephoneBalance ? parseFloat(telephoneBalance) : 0,
      telephone_cash: telephoneCash ? parseFloat(telephoneCash) : 0
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
        window.location.hash = '/';
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
        } catch (e) { }
      }

      if (!res.ok || apiResponse.status === 'error') {
        const fallbackMsg = `Failed to create closing entry. Server returned HTTP ${res.status}`;
        throw new Error(sysError || (typeof apiResponse === 'string' ? apiResponse : fallbackMsg));
      }

      const isDraft = saveAsDraft;
      const name = apiResponse.name || 'Unknown';
      const total = apiResponse.grand_total || invoicesData.grand_total || 0;

      // Extract details for the thermal slip
      const cashReco = paymentReconciliation.find(p => p.mode_of_payment === 'Cash') || {};
      const cardReco = paymentReconciliation.find(p => ['card', 'visa', 'master', 'credit card'].includes(p.mode_of_payment.toLowerCase())) || {};
      const onlineReco = paymentReconciliation.find(p => ['online', 'upi', 'bank transfer'].includes(p.mode_of_payment.toLowerCase())) || {};
      const instaReco = paymentReconciliation.find(p => p.mode_of_payment.toLowerCase().includes('insta')) || {};
      const creditReco = paymentReconciliation.find(p => p.mode_of_payment.toLowerCase().includes('credit') && !p.mode_of_payment.toLowerCase().includes('card')) || {};

      const countedCash = Object.keys(denomCounts).reduce((sum, k) => sum + (parseFloat(k) * (denomCounts[k] || 0)), 0) || parseFloat(cashReco.closing_amount || 0);

      const opEntry = openingEntries.find(o => o.name === selectedOpeningEntry);

      const handoverAmount = parseFloat(cashReco.collected_handover || invoicesData.total_collections_collected || 0);
      const cashSaleAmount = parseFloat(cashReco.paid_amount || 0);

      setThermalData({
        name,
        isDraft,
        date: postingDate ? postingDate.split('T')[0] : new Date().toISOString().split('T')[0],
        startTime: opEntry?.period_start_date ? new Date(opEntry.period_start_date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '9:10am',
        endTime: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase(),
        status: isDraft ? 'Draft Closing' : 'Closed',
        cashSale: cashSaleAmount,
        handoverAmount: handoverAmount,
        expectedCash: parseFloat(cashReco.expected_amount || 0),
        cardSale: parseFloat(cardReco.expected_amount || cardReco.paid_amount || 0),
        onlinePayment: parseFloat(onlineReco.expected_amount || onlineReco.paid_amount || 0),
        instaCash: parseFloat(instaReco.expected_amount || instaReco.paid_amount || 0),
        creditSale: parseFloat(creditReco.expected_amount || creditReco.paid_amount || 0),
        netTotal: total,
        counterCash: countedCash,
        openingFloat: parseFloat(cashReco.opening_amount || 0),
        invoicesCount: invoicesData.invoices?.length || 0,
        userName: currentUser || localStorage.getItem('user') || 'Cashier',
        company: company,
        posProfile: currentPosProfile || localStorage.getItem('pos_profile') || ''
      });

      if (isDraft) {
        setSuccessMessage("Shift data saved successfully! View/Print the slip below before exiting.");
      } else {
        setSuccessMessage(
          `POS Closing Entry submitted successfully! Name: ${name}, Total: د.إ ${total.toFixed(2)}`
        );
      }

      setShowThermalModal(true);

    } catch (err) {
      let msg = err.message;
      setError(`Failed to submit: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const cashReconciliation = paymentReconciliation.find(p => p.mode_of_payment === 'Cash');

  if (loading && openingEntries.length === 0) {
    return (
      <div className="erp-page so-page" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span className="text-lg font-medium">Loading session list...</span>
        </div>
      </div>
    );
  }

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate();
      const month = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12 || 12;
      const paddedHours = hours.toString().padStart(2, '0');
      return `${day} ${month} ${year}, ${paddedHours}:${minutes} ${ampm}`;
    } catch (e) {
      return dateStr;
    }
  };

  if (isReadOnly || routeId) {
    const detail = closingDetailData || {};
    const reconciliations = detail.payment_reconciliation || [];
    const isSubmitted = detail.docstatus === 1;

    return (
      <div className="pos-ope-page-wrapper">
        {/* 1. TOP HEADER BAR */}
        <div className="pos-ope-header-bar">
          <div className="pos-ope-header-left">
            <button className="pos-ope-back-btn" onClick={() => navigate('/posclosingentrylist')} title="Back to List">
              <ArrowLeft size={18} />
            </button>
            <div className="pos-ope-title-group">
              <div className="pos-ope-title-row">
                <h1 className="pos-ope-title">{routeId || 'POS CLOSING ENTRY'}</h1>
                <span className="pos-ope-badge" style={!isSubmitted ? { background: '#fef3c7', color: '#d97706', borderColor: '#fde68a' } : {}}>
                  <span className="pos-ope-badge-dot" style={!isSubmitted ? { backgroundColor: '#d97706' } : {}}></span>
                  {isSubmitted ? 'SUBMITTED' : 'DRAFT'}
                </span>
              </div>
              <p className="pos-ope-subtitle">Point of Sale Shift Closing & Settlement Record</p>
            </div>
          </div>

          <div className="pos-ope-header-right">
            <button className="erp-button erp-button-secondary pos-ope-btn-secondary" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
            <button className="erp-button erp-button-secondary pos-ope-btn-secondary" onClick={() => navigate('/posclosingentrylist')}>
              <ArrowLeft size={14} /> Back to List
            </button>
          </div>
        </div>

        {/* 2. PAGE CONTAINER */}
        <div className="pos-ope-container">
          <div className="pos-ope-content-grid">

            {/* CARD 1: CLOSING ENTRY INFORMATION */}
            <div className="pos-ope-card">
              <div className="pos-ope-card-header">
                <div className="pos-ope-card-title">
                  <FileText className="pos-ope-card-icon" size={18} /> CLOSING ENTRY INFORMATION
                </div>
              </div>
              <div className="pos-ope-card-body">
                <div className="pos-ope-meta-grid">
                  <div className="pos-ope-info-item">
                    <div className="pos-ope-info-icon">
                      <User size={18} />
                    </div>
                    <div className="pos-ope-info-details">
                      <span className="pos-ope-info-label">CLOSING CASHIER / USER</span>
                      <span className="pos-ope-info-value">{detail.user || currentUser || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pos-ope-info-item">
                    <div className="pos-ope-info-icon">
                      <Building2 size={18} />
                    </div>
                    <div className="pos-ope-info-details">
                      <span className="pos-ope-info-label">COMPANY</span>
                      <span className="pos-ope-info-value">{detail.company || company || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pos-ope-info-item">
                    <div className="pos-ope-info-icon">
                      <Store size={18} />
                    </div>
                    <div className="pos-ope-info-details">
                      <span className="pos-ope-info-label">POS PROFILE</span>
                      <span className="pos-ope-info-value">{detail.pos_profile || currentPosProfile || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pos-ope-info-item">
                    <div className="pos-ope-info-icon">
                      <Calendar size={18} />
                    </div>
                    <div className="pos-ope-info-details">
                      <span className="pos-ope-info-label">SHIFT START DATE</span>
                      <span className="pos-ope-info-value">{formatDisplayDate(detail.period_start_date || detail.posting_date)}</span>
                    </div>
                  </div>

                  <div className="pos-ope-info-item">
                    <div className="pos-ope-info-icon">
                      <Calendar size={18} />
                    </div>
                    <div className="pos-ope-info-details">
                      <span className="pos-ope-info-label">SHIFT END DATE</span>
                      <span className="pos-ope-info-value">{formatDisplayDate(detail.period_end_date || detail.posting_date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: PAYMENT RECONCILIATION SUMMARY */}
            <div className="pos-ope-card">
              <div className="pos-ope-card-header">
                <div className="pos-ope-card-title">
                  <Wallet className="pos-ope-card-icon" size={18} /> PAYMENT RECONCILIATION SUMMARY
                </div>
              </div>
              <div className="pos-ope-card-body">
                <div className="erp-table-scroll pos-ope-table-container">
                  <table className="erp-table pos-ope-table">
                    <thead>
                      <tr>
                        <th>MODE OF PAYMENT</th>
                        <th style={{ textAlign: 'right' }}>OPENING</th>
                        <th style={{ textAlign: 'right' }}>EXPECTED</th>
                        <th style={{ textAlign: 'right' }}>CLOSING</th>
                        <th style={{ textAlign: 'right' }}>DIFFERENCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliations.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                            No payment reconciliations recorded
                          </td>
                        </tr>
                      ) : (
                        reconciliations.map((r, idx) => {
                          const diff = parseFloat(r.difference || 0);
                          return (
                            <tr key={idx}>
                              <td>
                                <div className="pos-ope-payment-cell">
                                  <div className="pos-ope-payment-icon">
                                    <Banknote size={16} />
                                  </div>
                                  <span>{r.mode_of_payment}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                                AED {parseFloat(r.opening_amount || 0).toFixed(2)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                                AED {parseFloat(r.expected_amount || 0).toFixed(2)}
                              </td>
                              <td className="pos-ope-amount-cell" style={{ textAlign: 'right' }}>
                                AED {parseFloat(r.closing_amount || 0).toFixed(2)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: diff < 0 ? '#ef4444' : '#16a34a' }}>
                                AED {diff.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Discrepancy Reason */}
                {detail.discrepancy_reason && (
                  <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#9f1239', letterSpacing: '0.04em' }}>
                      Discrepancy Reason
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#be123c', marginTop: '4px' }}>
                      {detail.discrepancy_reason}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 3: TOTAL SETTLED SHIFT AMOUNT */}
            <div className="pos-ope-total-card">
              <div className="pos-ope-total-left">
                <div className="pos-ope-total-icon">
                  <Coins size={22} />
                </div>
                <div>
                  <div className="pos-ope-total-title">TOTAL SETTLED SHIFT AMOUNT</div>
                  <div className="pos-ope-total-sub">United Arab Emirates Dirham</div>
                </div>
              </div>
              <div className="pos-ope-total-amount">
                AED {parseFloat(detail.grand_total || 0).toFixed(2)}
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pce-container">
      {/* Top Navigation Bar */}
      <div className="pce-header">
        <div className="pce-header-left">
          <div className="pce-header-icon">
            <Receipt size={26} />
          </div>
          <div>
            <div className="pce-title-row">
              <h1 className="pce-title">
                POS SHIFT CLOSING ENTRY
              </h1>
              <span className="pce-tag">
                Shift Reconciliation
              </span>
            </div>
            <div className="pce-subtitle">
              Reconcile physical cash, digital payments, and finalize day shift sales
            </div>
          </div>
        </div>

        <div className="pce-header-actions">
          <button
            onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
            className="pce-btn-theme"
          >
            <Palette size={15} />
            <span>{polTheme}</span>
          </button>

          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 4px' }}></div>

          {userRoles.includes('Administrator') || userRoles.includes('System Manager') ? (
            <>
              <button
                className="pce-btn-draft"
                onClick={() => handleSubmit(true)}
                disabled={loading || !invoicesData}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                <span>Save Draft</span>
              </button>
              <button
                className="pce-btn-submit"
                onClick={() => handleSubmit(false)}
                disabled={loading || !invoicesData}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>{loading ? 'Processing...' : 'Finalize & Submit Shift'}</span>
              </button>
            </>
          ) : (
            <button
              className="pce-btn-submit green"
              onClick={() => handleSubmit(true)}
              disabled={loading || !invoicesData}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              <span>{loading ? 'Processing...' : 'Save Shift as Draft'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="pce-body">
        <div className="pce-content">
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#991b1b', fontSize: '0.85rem', fontWeight: 600 }}>
              <AlertCircle size={20} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#166534', fontSize: '0.85rem', fontWeight: 600 }}>
              <CheckCircle2 size={20} color="#16a34a" />
              <span>{successMessage}</span>
            </div>
          )}

          {noInvoicesMessage && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#92400e', fontSize: '0.85rem', fontWeight: 600 }}>
              <AlertCircle size={20} color="#d97706" />
              <span>{noInvoicesMessage}</span>
            </div>
          )}

          {/* Pending Inter-Branch Stock Transfers Alert */}
          {pendingBranchReqs.has_pending && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '16px', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309', flexShrink: 0 }}>
                <Truck size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Pending Inter-Branch Stock Transfers / Requests Alert
                  </span>
                  <span style={{ background: '#fde68a', color: '#92400e', fontSize: '0.65rem', fontWeight: 900, padding: '0.2rem 0.6rem', borderRadius: '9999px', textTransform: 'uppercase' }}>
                    Action Required
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.35rem', lineHeight: 1.5, fontWeight: 500 }}>
                  This branch has <strong>{pendingBranchReqs.pending_mr_count} pending Material Request(s) (MR)</strong> and <strong>{pendingBranchReqs.pending_mt_count} in-transit/draft Stock Transfer(s) (MT)</strong>. Please review or complete them before shift handover.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                  {pendingBranchReqs.pending_mr.slice(0, 3).map((mr) => (
                    <span key={mr.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', background: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                      <ArrowRightLeft size={13} color="#d97706" />
                      MR: {mr.name} <span style={{ color: '#d97706', fontWeight: 500 }}>({mr.status})</span>
                    </span>
                  ))}
                  {pendingBranchReqs.pending_mt.slice(0, 3).map((mt) => (
                    <span key={mt.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', background: '#ffffff', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                      <Truck size={13} color="#2563eb" />
                      MT: {mt.name} <span style={{ color: '#64748b', fontWeight: 500 }}>({mt.from_warehouse} → {mt.to_warehouse})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Shift Details Selector Card */}
          <div className="pce-card">
            <div className="pce-card-header">
              <div className="pce-card-header-left">
                <div className="pce-card-icon-pill blue">
                  <Calendar size={18} />
                </div>
                <div>
                  <div className="pce-card-title">Shift Identification & Date Period</div>
                  <div className="pce-card-desc">Select POS Opening Session to load transactions</div>
                </div>
              </div>
            </div>
            <div className="pce-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                <div className="pce-field-group">
                  <label className="pce-field-label">
                    POS Opening Entry <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="pce-select"
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
                    <ChevronDown size={16} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                  </div>
                </div>

                <div className="pce-field-group">
                  <label className="pce-field-label">Posting Date & Time</label>
                  <input
                    type="datetime-local"
                    className="pce-input"
                    value={postingDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                  />
                </div>

                <div className="pce-field-group">
                  <label className="pce-field-label">Period End Date & Time</label>
                  <input
                    type="datetime-local"
                    className="pce-input"
                    value={periodEndDate}
                    onChange={(e) => setPeriodEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {invoicesData && (
            <>
              {/* Summary KPI Dashboard */}
              <div className="pce-kpi-grid">
                <div className="pce-kpi-card sales">
                  <div className="pce-kpi-top">
                    <div className="pce-kpi-pill">
                      <DollarSign size={20} />
                    </div>
                    <span className="pce-kpi-label">Total Sales Turnover</span>
                  </div>
                  <div className="pce-kpi-value-box">
                    <div className="pce-kpi-value">
                      <span className="pce-kpi-currency">AED</span>
                      {flt(invoicesData.grand_total).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="pce-kpi-sub">
                    <TrendingUp size={14} /> Total collected across all modes
                  </div>
                </div>

                <div className="pce-kpi-card invoices">
                  <div className="pce-kpi-top">
                    <div className="pce-kpi-pill">
                      <Receipt size={20} />
                    </div>
                    <span className="pce-kpi-label">Invoices Billed</span>
                  </div>
                  <div className="pce-kpi-value-box">
                    <div className="pce-kpi-value">
                      {invoicesData.invoices.length} <span style={{ fontSize: '1rem', opacity: 0.7, fontWeight: 700 }}>Bills</span>
                    </div>
                  </div>
                  <div className="pce-kpi-sub">
                    Successful transactions in shift
                  </div>
                </div>

                <div className="pce-kpi-card quantity">
                  <div className="pce-kpi-top">
                    <div className="pce-kpi-pill">
                      <FileText size={20} />
                    </div>
                    <span className="pce-kpi-label">Items Quantity Sold</span>
                  </div>
                  <div className="pce-kpi-value-box">
                    <div className="pce-kpi-value">
                      {flt(invoicesData.total_quantity).toFixed(0)} <span style={{ fontSize: '1rem', opacity: 0.7, fontWeight: 700 }}>Units</span>
                    </div>
                  </div>
                  <div className="pce-kpi-sub">
                    Total volume moved during session
                  </div>
                </div>

                {flt(invoicesData.total_collections_collected) > 0 && (
                  <div className="pce-kpi-card handover">
                    <div className="pce-kpi-top">
                      <div className="pce-kpi-pill">
                        <HandCoins size={20} />
                      </div>
                      <span className="pce-kpi-label">Cash Handovers (Collections)</span>
                    </div>
                    <div className="pce-kpi-value-box">
                      <div className="pce-kpi-value">
                        <span className="pce-kpi-currency">AED</span>
                        {flt(invoicesData.total_collections_collected).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="pce-kpi-sub">
                      <CheckCircle2 size={14} /> {(invoicesData.branch_collections || []).length} handover(s) collected today
                    </div>
                  </div>
                )}
              </div>

              {/* Shift Breakdown by Payment Mode */}
              <div className="pce-card">
                <div className="pce-card-header">
                  <div className="pce-card-header-left">
                    <div className="pce-card-icon-pill violet">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <div className="pce-card-title">Shift Transactions by Payment Method</div>
                      <div className="pce-card-desc">Total sales collected categorized by payment channels</div>
                    </div>
                  </div>
                </div>
                <div className="pce-card-body">
                  <div className="pce-mode-grid">
                    {paymentReconciliation.map((pr) => {
                      const mode = pr.mode_of_payment.toLowerCase();
                      let modeClass = 'cash';
                      if (mode.includes('card')) modeClass = 'card';
                      else if (mode.includes('bank') || mode.includes('transfer')) modeClass = 'bank';
                      else if (mode.includes('insta')) modeClass = 'insta';
                      else if (mode.includes('credit')) modeClass = 'credit';

                      return (
                        <div key={pr.mode_of_payment} className={`pce-mode-item ${modeClass}`}>
                          <div className="pce-mode-title">{pr.mode_of_payment}</div>
                          <div className="pce-mode-amount">
                            <span style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 800 }}>AED</span>
                            <span>{(pr.paid_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Two Column Layout: UAE Cash Count (Left) vs Reconciliation & Tax (Right) */}
              <div className="pce-two-col">
                {/* LEFT COLUMN: Counted Denominations + Telephone Machine */}
                <div className="pce-col-stack">
                  {/* UAE Cash Denominations Card */}
                  <div className="pce-card">
                    <div className="pce-card-header">
                      <div className="pce-card-header-left">
                        <div className="pce-card-icon-pill emerald">
                          <DollarSign size={18} />
                        </div>
                        <div>
                          <div className="pce-card-title">Counted UAE Cash Denominations</div>
                          <div className="pce-card-desc">Enter quantity of physical notes & coins</div>
                        </div>
                      </div>
                      <div className="pce-total-badge">
                        <span className="pce-total-badge-lbl">Total Counted:</span>
                        <span className="pce-total-badge-val">
                          AED {Object.keys(denomCounts).reduce((sum, k) => sum + (parseFloat(k) * (denomCounts[k] || 0)), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="pce-card-body" style={{ background: '#fcfdfd' }}>
                      <div className="pce-denom-grid">
                        {UAE_DENOMINATIONS.map((d) => {
                          const count = denomCounts[d.value] || 0;
                          const subtotal = (d.value * count);
                          const isNote = d.label.includes('Note');

                          return (
                            <div key={d.value} className={`pce-denom-box ${count > 0 ? 'active' : ''}`}>
                              <div className="pce-denom-header">
                                <span className={`pce-denom-tag ${isNote ? 'note' : 'coin'}`}>
                                  {d.value >= 1 ? `${d.value} AED` : `${d.value.toFixed(2)} AED`}
                                </span>
                                <span className={`pce-denom-subtotal ${count === 0 ? 'zero' : ''}`}>
                                  = {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="pce-denom-input-wrap">
                                <span className="pce-denom-qty-lbl">QTY</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={denomCounts[d.value] === 0 ? '' : denomCounts[d.value]}
                                  onChange={(e) => handleDenomChange(d.value, e.target.value)}
                                  className="pce-denom-input"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Telephone Machine Balance Card */}
                  <div className="pce-card">
                    <div className="pce-card-header">
                      <div className="pce-card-header-left">
                        <div className="pce-card-icon-pill sky">
                          <Receipt size={18} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="pce-card-title">Telephone Machine Balance</div>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.15rem 0.5rem', borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Required
                            </span>
                          </div>
                          <div className="pce-card-desc">Record telecom machine e-wallet balance & cash</div>
                        </div>
                      </div>
                    </div>
                    <div className="pce-card-body">
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                        <div className="pce-field-group">
                          <label className="pce-field-label">User</label>
                          <input
                            type="text"
                            readOnly
                            value={currentUser || localStorage.getItem('user') || 'Current User'}
                            className="pce-input"
                            disabled
                          />
                        </div>
                        <div className="pce-field-group">
                          <label className="pce-field-label">Date & Time</label>
                          <input
                            type="text"
                            readOnly
                            value={new Date().toLocaleString()}
                            className="pce-input"
                            disabled
                          />
                        </div>
                        <div className="pce-field-group">
                          <label className="pce-field-label">
                            Balance (AED) <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={telephoneBalance}
                            onChange={e => setTelephoneBalance(e.target.value)}
                            className="pce-input"
                            required
                          />
                        </div>
                        <div className="pce-field-group">
                          <label className="pce-field-label">
                            Cash (AED) <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={telephoneCash}
                            onChange={e => setTelephoneCash(e.target.value)}
                            className="pce-input"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Payment Reconciliation Table + Discrepancy + Taxes */}
                <div className="pce-col-stack">
                  {/* Payment Reconciliation Table */}
                  <div className="pce-card">
                    <div className="pce-card-header">
                      <div className="pce-card-header-left">
                        <div className="pce-card-icon-pill amber">
                          <CreditCard size={18} />
                        </div>
                        <div>
                          <div className="pce-card-title">Payment Reconciliation Table</div>
                          <div className="pce-card-desc">Compare expected collections against counted closing amounts</div>
                        </div>
                      </div>
                    </div>
                    <div className="erp-table-scroll pce-table-wrapper">
                      <table className="erp-table pce-table">
                        <thead>
                          <tr>
                            <th>Payment Mode</th>
                            <th style={{ textAlign: 'right' }}>Opening Float</th>
                            <th style={{ textAlign: 'right' }}>Sales</th>
                            <th style={{ textAlign: 'right' }}>Handover (Deducted)</th>
                            <th style={{ textAlign: 'right' }}>Expected in Drawer</th>
                            <th style={{ textAlign: 'right', width: '135px' }}>Closing Count</th>
                            <th style={{ textAlign: 'right' }}>Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentReconciliation.map((pr, idx) => (
                            <tr key={pr.mode_of_payment}>
                              <td style={{ fontWeight: 800, color: '#0f172a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '9999px', background: pr.mode_of_payment === 'Cash' ? '#10b981' : '#3b82f6' }}></span>
                                  {pr.mode_of_payment}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', color: '#64748b', fontWeight: 600 }}>{flt(pr.opening_amount).toFixed(2)}</td>
                              <td style={{ textAlign: 'right', color: '#059669', fontWeight: 800 }}>+{flt(pr.paid_amount).toFixed(2)}</td>
                              <td style={{ textAlign: 'right', color: flt(pr.collected_handover) > 0 ? '#dc2626' : '#94a3b8', fontWeight: 800 }}>
                                {flt(pr.collected_handover) > 0 ? `-${flt(pr.collected_handover).toFixed(2)}` : '0.00'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>{flt(pr.expected_amount).toFixed(2)}</td>
                              <td>
                                <input
                                  type="number"
                                  className="pce-table-input"
                                  value={pr.closing_amount !== undefined ? pr.closing_amount : ''}
                                  onChange={(e) => handleClosingAmountChange(idx, e.target.value)}
                                  disabled={pr.mode_of_payment === 'Cash'}
                                  ref={(el) => (closingAmountRefs.current[idx] = el)}
                                />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 900, color: pr.difference > 0 ? '#ef4444' : pr.difference < 0 ? '#10b981' : '#94a3b8' }}>
                                {flt(pr.difference) === 0 ? '0.00' : flt(pr.difference).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Discrepancy Alert */}
                  {cashReconciliation && flt(cashReconciliation.difference) !== 0 && (
                    <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                        <AlertCircle size={22} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Cash Discrepancy Warning
                          </div>
                          <div style={{ fontSize: '0.825rem', color: '#92400e', marginTop: '0.35rem', lineHeight: 1.5 }}>
                            Counted cash (AED {flt(cashReconciliation.closing_amount).toFixed(2)}) does not match expected (AED {flt(cashReconciliation.expected_amount).toFixed(2)}). 
                            Variance: <strong style={{ color: '#dc2626' }}>AED {flt(-cashReconciliation.difference).toFixed(2)}</strong>.
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', color: '#78350f', letterSpacing: '0.04em' }}>
                          Reason for Discrepancy: <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea
                          value={discrepancyReason}
                          onChange={(e) => setDiscrepancyReason(e.target.value)}
                          style={{ width: '100%', padding: '0.75rem 1rem', background: '#ffffff', border: '1.5px solid #fcd34d', borderRadius: '10px', fontSize: '0.825rem', outline: 'none', fontWeight: 600, color: '#0f172a', resize: 'vertical', boxSizing: 'border-box' }}
                          placeholder="Provide explanation for this cash variance..."
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  {/* Tax Statistics Card */}
                  <div className="pce-card">
                    <div className="pce-card-header">
                      <div className="pce-card-header-left">
                        <div className="pce-card-icon-pill slate">
                          <TrendingUp size={18} />
                        </div>
                        <div>
                          <div className="pce-card-title">Tax & VAT Breakdown</div>
                          <div className="pce-card-desc">Applicable VAT tax collected on shift invoices</div>
                        </div>
                      </div>
                    </div>
                    <div className="erp-table-scroll pce-table-wrapper">
                      <table className="erp-table pce-table">
                        <thead>
                          <tr>
                            <th>Account Head</th>
                            <th style={{ textAlign: 'right' }}>Tax Rate</th>
                            <th style={{ textAlign: 'right' }}>Total Tax Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicesData.taxes && invoicesData.taxes.map((tax) => (
                            <tr key={tax.account_head}>
                              <td style={{ fontWeight: 600, color: '#334155' }}>{tax.account_head}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#64748b' }}>{tax.rate}%</td>
                              <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                                AED {flt(tax.amount).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices List Card */}
              <div className="pce-card">
                <div className="pce-card-header">
                  <div className="pce-card-header-left">
                    <div className="pce-card-icon-pill slate">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <div className="pce-card-title">Shift Transaction Log ({invoicesData.invoices?.length || 0})</div>
                      <div className="pce-card-desc">Detailed log of customer invoices created in this session</div>
                    </div>
                  </div>
                </div>
                <div className="erp-table-scroll pce-table-wrapper" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                  <table className="erp-table pce-table">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                      <tr>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Posting Date</th>
                        <th style={{ textAlign: 'right' }}>Grand Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoicesData.invoices && invoicesData.invoices.map((inv) => (
                        <tr key={inv.name}>
                          <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#0f172a' }}>{inv.name}</td>
                          <td style={{ color: '#475569', fontWeight: 600 }}>{inv.customer_name}</td>
                          <td style={{ color: '#64748b' }}>{new Date(inv.posting_date).toLocaleDateString()}</td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                            AED {flt(inv.grand_total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mid-Day Cash Handover Collections Card */}
              {invoicesData.branch_collections && invoicesData.branch_collections.length > 0 && (
                <div className="pce-card" style={{ border: '1px solid #fed7aa', background: '#fffaf5' }}>
                  <div className="pce-card-header" style={{ background: '#fff7ed', borderBottom: '1px solid #ffedd5' }}>
                    <div className="pce-card-header-left">
                      <div className="pce-card-icon-pill" style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74' }}>
                        <HandCoins size={18} />
                      </div>
                      <div>
                        <div className="pce-card-title" style={{ color: '#9a3412' }}>Mid-Day Cash Handover Collection Log ({invoicesData.branch_collections.length})</div>
                        <div className="pce-card-desc" style={{ color: '#c2410c' }}>Authorised cash handovers collected from this drawer today</div>
                      </div>
                    </div>
                    <div className="pce-total-badge" style={{ background: '#fed7aa', borderColor: '#f97316' }}>
                      <span className="pce-total-badge-lbl" style={{ color: '#7c2d12' }}>Total Handed Over:</span>
                      <span className="pce-total-badge-val" style={{ color: '#9a3412' }}>
                        AED {flt(invoicesData.total_collections_collected).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="erp-table-scroll pce-table-wrapper" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="erp-table pce-table">
                      <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#ffedd5' }}>
                        <tr>
                          <th>Collection Voucher</th>
                          <th>Time</th>
                          <th>Collector / Employee</th>
                          <th>Mode</th>
                          <th style={{ textAlign: 'right' }}>Collected Amount</th>
                          <th style={{ textAlign: 'right' }}>Drawer Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicesData.branch_collections.map((coll) => (
                          <tr key={coll.name} style={{ background: '#ffffff' }}>
                            <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#9a3412' }}>{coll.name}</td>
                            <td style={{ color: '#64748b', fontWeight: 600 }}>{coll.posting_time ? coll.posting_time.slice(0, 5) : '—'}</td>
                            <td>
                              <div style={{ fontWeight: 800, color: '#0f172a' }}>{coll.collector_name || 'Collector'}</div>
                              {coll.employee && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{coll.employee}</div>}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#ffedd5', color: '#c2410c', padding: '0.2rem 0.55rem', borderRadius: '9999px', border: '1px solid #fed7aa' }}>
                                {coll.collection_type}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 900, color: '#dc2626' }}>
                              -AED {flt(coll.amount).toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                              AED {flt(coll.remaining_balance).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ height: '2rem' }}></div>
        </div>
      </div>

      {/* ==================== THERMAL DAY SUMMARY PREVIEW MODAL ==================== */}
      {showThermalModal && thermalData && (
        <div className="dsr-modal-backdrop" style={{ zIndex: 9999 }} onClick={() => {}}>
          <div className="dsr-modal-card" style={{ maxWidth: '440px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="erp-dialog-edge dsr-modal-header" style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} className="text-emerald-600" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>POS Shift Closing Slip</h3>
              </div>
              <button onClick={handleFinalLogout} className="text-slate-400 hover:text-slate-600 p-1" title="Logout & Exit">
                <X size={18} />
              </button>
            </div>

            <div className="erp-dialog-body dsr-modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.25rem', background: '#f1f5f9' }}>
              <div className="dsr-thermal-slip" id="closing-shift-thermal-slip" style={{ background: '#ffffff', padding: '16px 14px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', color: '#000000', lineHeight: 1.35 }}>
                <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '14px', marginBottom: '2px' }}>
                  {thermalData.company || 'KYLE SOLUTIONS'}
                </div>
                <div style={{ textAlign: 'center', fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                  {thermalData.posProfile}
                </div>

                <div className="thermal-top-row" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12.5px', marginBottom: '2px' }}>
                  <span>{new Date(thermalData.date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                  <span>{thermalData.date.split('-').reverse().join('/')}</span>
                </div>
                <div className="thermal-sub-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginBottom: '4px' }}>
                  <span>{thermalData.startTime}</span>
                  <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{thermalData.status}</span>
                  <span>{thermalData.endTime}</span>
                </div>

                <div className="thermal-dotted-sep" style={{ borderTop: '1px dotted #000', margin: '6px 0' }}></div>

                <div className="thermal-table-body" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cash Sale</span>
                    <span style={{ fontWeight: 600 }}>{(thermalData.cashSale || 0).toFixed(2)}</span>
                  </div>
                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Card Sale</span>
                    <span style={{ fontWeight: 600 }}>{(thermalData.cardSale || 0).toFixed(2)}</span>
                  </div>
                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Online Payment</span>
                    <span style={{ fontWeight: 600 }}>{(thermalData.onlinePayment || 0).toFixed(2)}</span>
                  </div>
                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ins. Cash</span>
                    <span style={{ fontWeight: 600 }}>{(thermalData.instaCash || 0).toFixed(2)}</span>
                  </div>
                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Credit Sale</span>
                    <span style={{ fontWeight: 600 }}>{(thermalData.creditSale || 0).toFixed(2)}</span>
                  </div>

                  <div className="thermal-line-sep" style={{ borderTop: '1px solid #000', margin: '6px 0' }}></div>

                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '13px' }}>
                    <span>Total Sales ({thermalData.invoicesCount || 0} Bills)</span>
                    <span>{(thermalData.netTotal || 0).toFixed(2)}</span>
                  </div>

                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Opening Cash</span>
                    <span style={{ fontWeight: 600 }}>{(thermalData.openingFloat || 0).toFixed(2)}</span>
                  </div>
                  {parseFloat(thermalData.handoverAmount || 0) > 0 && (
                    <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
                      <span>- Handover Collected</span>
                      <span style={{ fontWeight: 600 }}>-{(thermalData.handoverAmount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>Expected Drawer Cash</span>
                    <span>{(thermalData.expectedCash || 0).toFixed(2)}</span>
                  </div>
                  <div className="thermal-row-3col" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
                    <span>Counter / Counted Cash</span>
                    <span>{(thermalData.counterCash || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="thermal-dotted-sep" style={{ borderTop: '1px dotted #000', margin: '6px 0' }}></div>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
                  User: {thermalData.userName} | Ref: {thermalData.name}
                </div>
              </div>
            </div>

            <div className="erp-dialog-edge dsr-modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handlePrintThermalSlip}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-colors shadow-sm cursor-pointer"
              >
                <Printer size={15} />
                <span>Print Thermal Slip (80mm)</span>
              </button>

              <button
                type="button"
                onClick={handleFinalLogout}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors shadow-sm cursor-pointer"
              >
                <LogOut size={15} />
                <span>Logout & Exit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClosingEntry;
