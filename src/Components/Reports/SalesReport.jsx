import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Loader2, FileText, AlertCircle, CheckCircle2,
  Calendar, Search, Filter, Palette, RefreshCw,
  Download, Printer, ChevronDown, TrendingUp, DollarSign, CreditCard, Layers, Zap, Coins, ExternalLink, Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Admin/SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import PrintConfigModal from './PrintConfigModal';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';


function SalesReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnConfig, setColumnConfig] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Print Customization State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOrientation, setPrintOrientation] = useState('portrait');
  const [selectedPrintColumns, setSelectedPrintColumns] = useState([]);

  useEffect(() => {
    if (columns.length > 0 && selectedPrintColumns.length === 0) {
      setSelectedPrintColumns(columns.map(c => c.fieldname));
    }
  }, [columns]);
  const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, themeHeaderBg, themeHeaderText, toggleTheme } = useLegacyTheme();

  // Redux Hook
  const { warehouse, user_roles } = useSelector((state) => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const getPaymentModeFromUrl = () => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get('payment_mode') || searchParams.get('payment_mode') || '';
  };

  const [filters, setFilters] = useState({
    from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0], // 1st of current month
    to_date: new Date().toISOString().split('T')[0],
    customer: '',
    warehouse: '',
    payment_mode: getPaymentModeFromUrl()
  });

  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [breakdown, setBreakdown] = useState({
    grand_total: 0,
    net_total: 0,
    cash: 0,
    card: 0,
    instapay: 0,
    credit: 0,
    other: 0
  });

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  useEffect(() => {
    fetchCustomers();
    if (isAdmin) {
      fetchWarehouses();
    }
  }, [isAdmin]);

  // Dynamic role-based filters hydration
  useEffect(() => {
    const updatedFilters = { ...filters };
    if (!isAdmin && warehouse) {
      updatedFilters.warehouse = warehouse;
    }
    setFilters(updatedFilters);
    fetchReport(updatedFilters);
  }, [warehouse, isAdmin]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_PATH}.get_customers_list_rpt`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setCustomers((json.message || json.data || json) || []);
    } catch (err) {
      console.error('Customers fetch error:', err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses', {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = json.message || json.data || [];
      const results = list.map(w => ({
        value: w.name,
        label: w.warehouse_name || w.name
      }));
      setWarehouses(results);
    } catch (err) {
      console.error("Failed to fetch warehouses:", err);
      setWarehouses([]);
    }
  };

  const fetchReport = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Force non-admin role restriction before querying
      const queryFilters = { ...activeFilters };
      if (!isAdmin && warehouse) {
        queryFilters.warehouse = warehouse;
      }

      const params = new URLSearchParams(queryFilters);
      const res = await fetch(`${API_PATH}.get_sales_report?${params.toString()}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const payload = result.message || result;

      if (payload.status === 'success') {
        setData(payload.data || []);
        const fetchedCols = payload.columns || [];
        setColumns(fetchedCols);

        // Merge with local storage config
        const savedConfigStr = localStorage.getItem('sales_report_columns');
        const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;

  const getDefaultColWidth = (fieldname, colWidth) => {
    if (colWidth && parseInt(colWidth) >= 150) {
      return typeof colWidth === 'number' ? colWidth + 'px' : colWidth;
    }
    switch (fieldname) {
      case 'posting_date': case 'date': return '130px';
      case 'name': case 'voucher_no': case 'sales_invoice': return '190px';
      case 'customer': return '160px';
      case 'customer_name': return '200px';
      case 'item_code': return '145px';
      case 'item_name': return '220px';
      case 'qty': return '90px';
      case 'rate': return '110px';
      case 'amount': return '125px';
      case 'tax_amount': return '120px';
      case 'total': case 'grand_total': case 'paid_amount': return '135px';
      case 'payment_mode': return '140px';
      case 'warehouse': return '160px';
      default: return (colWidth ? (typeof colWidth === 'number' ? colWidth + 'px' : colWidth) : '150px');
    }
  };

        let mergedCols = fetchedCols.map(c => ({
          id: c.fieldname,
          label: c.label,
          visible: true,
          width: getDefaultColWidth(c.fieldname, c.width),
          align: c.align || (c.fieldtype === 'Currency' || c.fieldtype === 'Float' ? 'right' : 'left'),
          original: c
        }));

        if (savedConfig && Array.isArray(savedConfig)) {
          const configMap = {};
          savedConfig.forEach(sc => configMap[sc.id] = sc);

          mergedCols = mergedCols.map(mc => {
            if (configMap[mc.id]) {
              return { ...mc, visible: configMap[mc.id].visible !== undefined ? configMap[mc.id].visible : true, width: configMap[mc.id].width || getDefaultColWidth(mc.id, null), align: configMap[mc.id].align };
            }
            return mc;
          });

          mergedCols.sort((a, b) => {
            const idxA = savedConfig.findIndex(sc => sc.id === a.id);
            const idxB = savedConfig.findIndex(sc => sc.id === b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
        }

        setColumnConfig(mergedCols);
        setBreakdown(payload.payment_breakdown || { grand_total: 0, net_total: 0, cash: 0, card: 0, instapay: 0, credit: 0, other: 0 });
        setSuccess('Report generated successfully');
      } else {
        setError(payload.message || payload.error || 'Unknown error');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterUpdate = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    fetchReport(next);
  };

  const handleMetricCardClick = (paymentMode, url) => {
    if (window.location.protocol === 'file:') {
      handleFilterUpdate('payment_mode', paymentMode);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleColumnUpdate = (newConfig) => {
    if (!newConfig) {
      localStorage.removeItem('sales_report_columns');
      const defaultCols = columns.map(c => ({
        id: c.fieldname,
        label: c.label,
        visible: true,
        width: getDefaultColWidth(c.fieldname, c.width),
        align: c.align || (c.fieldtype === 'Currency' || c.fieldtype === 'Float' ? 'right' : 'left'),
        original: c
      }));
      setColumnConfig(defaultCols);
      return;
    }
    setColumnConfig(newConfig);
    localStorage.setItem('sales_report_columns', JSON.stringify(newConfig));
  };

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  const executePrint = () => {
    setIsPrintModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const headers = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
      columns.map(c => `"${String(row[c.fieldname] || '-').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_summary_report_${filters.from_date}_to_${filters.to_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="so-page">
      <style dangerouslySetInnerHTML={{
        __html: `
        .so-filter-bar input.so-filter-input-icon,
        .so-filter-bar select.so-filter-input-icon {
          padding-left: 2.5rem !important;
        }
      `}} />

      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1.25rem 2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <FileText size={22} style={{ color: themeColor || '#0082f6' }} strokeWidth={2.5} />
            <span style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
              SALES SUMMARY REPORT
            </span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
            Aggregate data of all POS transactions and payment modes
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={toggleTheme}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 16px', height: '38px', background: '#ffffff', border: `1.5px solid ${themeColor || '#0082f6'}`, borderRadius: '8px', fontSize: '12px', fontWeight: 800, color: themeColor || '#0082f6', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            <Palette size={14} /> {isGreen ? 'BLUE THEME' : 'GREEN THEME'}
          </button>
          <div className="action-divider" style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 16px', height: '38px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 800, color: '#475569', cursor: 'pointer', textTransform: 'uppercase' }}
            onClick={() => setShowConfigModal(true)}
          >
            <Settings size={14} /> CUSTOMIZE COLUMNS
          </button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 16px', height: '38px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 800, color: '#475569', cursor: 'pointer', textTransform: 'uppercase' }}
            onClick={handlePrint}
          >
            <Printer size={14} /> PRINT
          </button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 16px', height: '38px', background: themeColor || '#0082f6', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, color: '#ffffff', cursor: 'pointer', textTransform: 'uppercase' }}
            onClick={handleExportCSV}
          >
            <Download size={14} /> EXPORT CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        <div className="so-layout">

          {/* 2. HORIZONTAL FILTERS */}
          <div className="filters-wrapper no-print" style={{ background: 'transparent', border: 'none', padding: 0, boxShadow: 'none', borderRadius: 0, marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label" style={{ textTransform: 'uppercase' }}>FROM DATE</label>
              <div className="so-relative">
                <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
                <input
                  type="date"
                  className="so-filter-input so-filter-input-icon"
                  value={filters.from_date}
                  onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                  onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label" style={{ textTransform: 'uppercase' }}>TO DATE</label>
              <div className="so-relative">
                <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
                <input
                  type="date"
                  className="so-filter-input so-filter-input-icon"
                  value={filters.to_date}
                  onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                  onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                />
              </div>
            </div>

            {/* DYNAMIC ROLE-BASED WAREHOUSE FILTER */}
            {isAdmin ? (
              <div style={{ flex: '1 1 250px' }}>
                <label className="so-filter-label" style={{ textTransform: 'uppercase' }}>BRANCH / WAREHOUSE</label>
                <div className="so-relative">
                  <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <select
                    className="so-filter-select so-filter-input-icon"
                    value={filters.warehouse}
                    onChange={(e) => handleFilterUpdate('warehouse', e.target.value)}
                  >
                    <option value="">ALL BRANCHES</option>
                    {warehouses.map(w => (
                      <option key={w.value} value={w.value}>{w.label || w.value}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }} />
                </div>
              </div>
            ) : warehouse ? (
              <div style={{ flex: '1 1 250px' }}>
                <label className="so-filter-label" style={{ textTransform: 'uppercase' }}>ACTIVE BRANCH</label>
                <div style={{
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  padding: '0 12px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#475569'
                }}>
                  <Filter size={14} style={{ color: themeColor }} />
                  {warehouse.replace(' - KSPL', '')}
                </div>
              </div>
            ) : null}

            <div style={{ flex: '1 1 250px' }}>
              <label className="so-filter-label" style={{ textTransform: 'uppercase' }}>FILTER BY CUSTOMER</label>
              <div className="so-relative" style={{ display: 'flex', alignItems: 'center' }}>
                <CustomSearchDropdown
                  placeholder="Search customer..."
                  value={filters.customer ? { name: filters.customer } : null}
                  onSelect={(item) => handleFilterUpdate('customer', item ? item.name : '')}
                  fetchData={async (query) => {
                    const q = (query || '').toLowerCase();
                    return customers.filter(c =>
                      (c.customer_name || c.name || '').toLowerCase().includes(q)
                    );
                  }}
                  optionsLabel="name"
                  themeColor={themeColor}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label" style={{ textTransform: 'uppercase' }}>PAYMENT MODE</label>
              <div className="so-relative">
                <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <select
                  className="so-filter-select so-filter-input-icon"
                  value={filters.payment_mode}
                  onChange={(e) => handleFilterUpdate('payment_mode', e.target.value)}
                >
                  <option value="">ALL PAYMENT MODES</option>
                  <option value="Cash">CASH</option>
                  <option value="Card">CARD</option>
                  <option value="InstaPay">INSTAPAY</option>
                  <option value="Credit">CREDIT SALES</option>
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }} />
              </div>
            </div>

            <button
              className="so-clear-btn"
              style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0, alignSelf: 'flex-end', textTransform: 'uppercase' }}
              onClick={() => {
                const reset = {
                  from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
                  to_date: new Date().toISOString().split('T')[0],
                  customer: '',
                  warehouse: isAdmin ? '' : (warehouse || ''),
                  payment_mode: ''
                };
                window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);
                setFilters(reset);
                fetchReport(reset);
              }}
            >
              RESET
            </button>
          </div>

          {/* 3. MAIN CONTENT AREA */}
          <main style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
            {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
              padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
              color: '#991b1b', fontSize: '0.85rem', fontWeight: 600
            }}>
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {/* PREMIUM METRIC DASHBOARD CARDS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Card 1: Grand Total */}
            <div
              className="po-card shadow-sm clickable-metric-card"
              onClick={() => handleMetricCardClick('', '/#/salesreport')}
              style={{ borderLeft: `4px solid ${themeColor}`, padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: themeColor }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Total POS Revenue</span>
                <TrendingUp size={14} style={{ color: themeColor }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <DirhamIcon size={18} /> {breakdown.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '0.25rem' }}>Net Total: <DirhamIcon size={9} /> {breakdown.net_total.toFixed(2)}</span>
            </div>

            {/* Card 2: Cash Payments */}
            <div
              className="po-card shadow-sm clickable-metric-card"
              onClick={() => handleMetricCardClick('Cash', '/#/salesreport?payment_mode=Cash')}
              style={{ borderLeft: '4px solid #10b981', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#10b981' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Cash Payments</span>
                <DollarSign size={14} style={{ color: '#10b981' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#047857', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <DirhamIcon size={18} /> {breakdown.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#10b981', display: 'block', marginTop: '0.25rem' }}>Physical Cash Sales</span>
            </div>

            {/* Card 3: Card Payments */}
            <div
              className="po-card shadow-sm clickable-metric-card"
              onClick={() => handleMetricCardClick('Card', '/#/salesreport?payment_mode=Card')}
              style={{ borderLeft: '4px solid #3b82f6', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#3b82f6' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Card Payments</span>
                <CreditCard size={14} style={{ color: '#3b82f6' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <DirhamIcon size={18} /> {breakdown.card.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#3b82f6', display: 'block', marginTop: '0.25rem' }}>Credit & Debit Cards</span>
            </div>

            {/* Card 4: InstaPay Payments */}
            <div
              className="po-card shadow-sm clickable-metric-card"
              onClick={() => handleMetricCardClick('InstaPay', '/#/salesreport?payment_mode=InstaPay')}
              style={{ borderLeft: '4px solid #06b6d4', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#06b6d4' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>InstaPay Payments</span>
                <Zap size={14} style={{ color: '#06b6d4' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#0891b2', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <DirhamIcon size={18} /> {(breakdown.instapay || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#06b6d4', display: 'block', marginTop: '0.25rem' }}>InstaPay Transactions</span>
            </div>

            {/* Card 5: Credit Customer Payments */}
            <div
              className="po-card shadow-sm clickable-metric-card"
              onClick={() => handleMetricCardClick('Credit', '/#/salesreport?payment_mode=Credit')}
              style={{ borderLeft: '4px solid #f59e0b', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#f59e0b' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Credit Sales</span>
                <Coins size={14} style={{ color: '#f59e0b' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <DirhamIcon size={18} /> {(breakdown.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#f59e0b', display: 'block', marginTop: '0.25rem' }}>Outstanding Credit Sales</span>
            </div>

            {/* Card 6: Loyalty Points Redeemed */}
            <div
              className="po-card shadow-sm"
              style={{ borderLeft: '4px solid #8b5cf6', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#8b5cf6' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Loyalty Points Redeemed</span>
                <Coins size={14} style={{ color: '#8b5cf6' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <DirhamIcon size={18} /> {(breakdown.loyalty_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#8b5cf6', display: 'block', marginTop: '0.25rem' }}>Customer Points Redeemed Value</span>
            </div>

            {/* Card 7: Total Discounts Given */}
            <div
              className="po-card shadow-sm"
              style={{ borderLeft: '4px solid #ec4899', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#ec4899' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Total Discounts Given</span>
                <TrendingUp size={14} style={{ color: '#ec4899' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#be185d', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <DirhamIcon size={18} /> {(breakdown.discount_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#ec4899', display: 'block', marginTop: '0.25rem' }}>Customer Price Discounts</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p className="so-list-meta">Found <b>{data.length}</b> records matching sequence</p>
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: themeColor, fontSize: '0.75rem', fontWeight: 700 }}>
              <Loader2 size={16} className="animate-spin" /> EXECUTING QUERY...
            </div>}
          </div>

          <div className="so-table-card">
            <div className="so-table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="so-table premium-stock-table" style={{ minWidth: '100%', width: 'max-content' }}>
                <thead>
                  <tr>
                    {columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).map((col, i) => (
                      <th key={col.id} style={{ width: col.width, minWidth: col.width, textAlign: col.align, textTransform: 'uppercase' }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && data.length === 0 ? (
                    <tr>
                      <td colSpan={columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).length || 1} className="so-empty" style={{ padding: '6rem 0' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                        <p style={{ marginTop: '1rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Processing Data Streams...</p>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).length || 1} className="so-empty" style={{ padding: '6rem 0' }}>
                        <div style={{ opacity: 0.2, marginBottom: '1rem' }}>
                          <FileText size={48} style={{ margin: '0 auto' }} />
                        </div>
                        <p>No transactions found for the selected criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).map((col, cIdx) => {
                          const fieldname = col.original.fieldname;
                          const cellValue = row[fieldname];
                          return (
                            <td
                              key={col.id}
                              style={{
                                textAlign: col.align,
                                fontFamily: col.original.fieldtype === 'Currency' || col.original.fieldtype === 'Float' ? 'monospace' : 'inherit',
                                width: col.width,
                                minWidth: col.width,
                                padding: '0.85rem 1rem',
                                whiteSpace: 'nowrap'
                              }}
                              title={String(cellValue ?? '')}
                            >
                              {cellValue !== null && cellValue !== undefined ? (
                                (fieldname === 'name' || fieldname === 'voucher_no') ? (
                                  <span onClick={() => navigate('/salesinvoicelist', { state: { search: cellValue } })} className="group flex items-center gap-1.5 hover:text-indigo-600 transition-colors underline-offset-4 hover:underline cursor-pointer" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569', justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                                    {String(cellValue).replace(' - KSPL', '')}
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                  </span>
                                ) : fieldname === 'item_code' ? (
                                  <span onClick={() => navigate('/itemlist', { state: { search: cellValue } })} className="code-capsule group flex items-center gap-1.5 w-fit hover:text-indigo-600 transition-colors cursor-pointer" style={{ marginLeft: col.align === 'right' ? 'auto' : '0' }}>
                                    {String(cellValue).replace(' - KSPL', '')}
                                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </span>
                                ) : typeof cellValue === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('amount')) ?
                                  cellValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) :
                                  String(cellValue).replace(' - KSPL', '')
                              ) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .clickable-metric-card {
            transition: all 0.2s ease-in-out;
            cursor: pointer;
        }
        .clickable-metric-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.08) !important;
            border-color: #cbd5e1 !important;
        }
        .clickable-metric-card:active {
            transform: translateY(-1px);
        }
        @media print {
            @page {
                size: ${printOrientation};
                margin: 10mm;
            }
            body {
                background: #ffffff !important;
                color: #000000 !important;
            }
            .no-print {
                display: none !important;
            }
            .so-page {
                padding: 0 !important;
                margin: 0 !important;
            }
            .so-content {
                padding: 0 !important;
            }
            .so-table-card {
                box-shadow: none !important;
                border: none !important;
            }
            th, td {
                border: 1px solid #cbd5e1 !important;
                padding: 8px 12px !important;
                font-size: 11px !important;
            }
        }
      `}} />

      <PrintConfigModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        columns={columns}
        selectedColumns={selectedPrintColumns}
        onSelectedColumnsChange={setSelectedPrintColumns}
        orientation={printOrientation}
        onOrientationChange={setPrintOrientation}
        onPrint={executePrint}
        themeColor={themeColor}
      />

      <ColumnConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={columnConfig}
        onUpdate={handleColumnUpdate}
        doctype="Sales Report"
        themeColor={themeColor}
      />
    </div>
  );
}

export default SalesReport;