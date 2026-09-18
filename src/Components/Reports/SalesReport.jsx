import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Loader2, FileText, AlertCircle, CheckCircle2,
  Calendar, Search, Filter, Palette, RefreshCw,
  Download, Printer, ChevronDown, TrendingUp, DollarSign, CreditCard,
  Zap, Coins, ExternalLink, Settings, RotateCcw, BarChart3, Gift, Percent,
  User, MapPin, ChevronLeft, ChevronRight, MoreVertical, Minus, ArrowRightLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './SalesReport.css';
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

  // Table local search & pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Print Customization State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOrientation, setPrintOrientation] = useState('portrait');
  const [selectedPrintColumns, setSelectedPrintColumns] = useState([]);

  useEffect(() => {
    if (columns.length > 0 && selectedPrintColumns.length === 0) {
      setSelectedPrintColumns(columns.map(c => c.fieldname));
    }
  }, [columns]);

  const { isGreen, themeColor, toggleTheme } = useLegacyTheme();

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
    loyalty_amount: 0,
    discount_amount: 0,
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
            case 'posting_date': case 'date': return '120px';
            case 'posting_time': return '120px';
            case 'creation': return '160px';
            case 'name': case 'voucher_no': case 'sales_invoice': return '180px';
            case 'customer': return '150px';
            case 'customer_name': return '180px';
            case 'item_code': return '140px';
            case 'item_name': return '200px';
            case 'qty': return '90px';
            case 'rate': return '110px';
            case 'amount': return '120px';
            case 'tax_amount': return '110px';
            case 'total': case 'grand_total': case 'paid_amount': case 'net_total': case 'tax_total': return '130px';
            case 'payment_mode': case 'mode_of_payment': return '140px';
            case 'warehouse': return '180px';
            case 'user': return '180px';
            case 'currency': return '90px';
            default: return (colWidth ? (typeof colWidth === 'number' ? colWidth + 'px' : colWidth) : '140px');
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
              return {
                ...mc,
                visible: configMap[mc.id].visible !== undefined ? configMap[mc.id].visible : true,
                width: configMap[mc.id].width || getDefaultColWidth(mc.id, null),
                align: configMap[mc.id].align
              };
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
        setBreakdown(payload.payment_breakdown || { grand_total: 0, net_total: 0, cash: 0, card: 0, instapay: 0, credit: 0, loyalty_amount: 0, discount_amount: 0, other: 0 });
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
    setCurrentPage(1);
    fetchReport(next);
  };

  const handleMetricCardClick = (paymentMode) => {
    handleFilterUpdate('payment_mode', paymentMode);
  };

  const handleColumnUpdate = (newConfig) => {
    if (!newConfig) {
      localStorage.removeItem('sales_report_columns');
      fetchReport();
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

  // Filtered & Paginated Table Data
  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (row.name || row.voucher_no || '').toLowerCase().includes(term) ||
      (row.customer || row.customer_name || '').toLowerCase().includes(term) ||
      (row.user || '').toLowerCase().includes(term) ||
      (row.payment_mode || row.mode_of_payment || '').toLowerCase().includes(term) ||
      (row.warehouse || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatPaymentPill = (mode) => {
    const m = (mode || '').toLowerCase();
    if (m.includes('cash')) return <span className="ssr-payment-pill cash">Cash</span>;
    if (m.includes('card')) return <span className="ssr-payment-pill card">Card</span>;
    if (m.includes('insta')) return <span className="ssr-payment-pill instapay">InstaPay</span>;
    if (m.includes('credit')) return <span className="ssr-payment-pill credit">Credit</span>;
    return <span className="ssr-payment-pill">{mode || 'N/A'}</span>;
  };

  return (
    <div className="ssr-page">
      {/* 1. HEADER SECTION */}
      <div className="ssr-header no-print">
        <div className="ssr-title-group">
          <div className="ssr-title-icon-box">
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="ssr-title-text">SALES SUMMARY REPORT</h1>
            <p className="ssr-subtitle">Aggregate data of all POS transactions and payment modes</p>
          </div>
        </div>

        <div className="ssr-header-actions">
          <button className="ssr-btn-theme" onClick={toggleTheme}>
            <Palette size={14} /> {isGreen ? 'Green Theme' : 'Blue Theme'}
          </button>
          <button className="ssr-btn-outline" onClick={() => setShowConfigModal(true)}>
            <Settings size={14} /> Customize Columns
          </button>
          <button className="ssr-btn-outline" onClick={handlePrint}>
            <Printer size={14} /> Print
          </button>
          <button className="ssr-btn-primary" onClick={handleExportCSV}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* 2. FILTER CARD */}
      <div className="ssr-filter-card no-print">
        {/* From Date */}
        <div className="ssr-field-block">
          <label className="ssr-label">From Date</label>
          <div className="ssr-input-wrapper">
            <Calendar size={14} className="ssr-input-icon" />
            <input
              type="date"
              className="ssr-input"
              value={filters.from_date}
              onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
              onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
            />
          </div>
        </div>

        {/* To Date */}
        <div className="ssr-field-block">
          <label className="ssr-label">To Date</label>
          <div className="ssr-input-wrapper">
            <Calendar size={14} className="ssr-input-icon" />
            <input
              type="date"
              className="ssr-input"
              value={filters.to_date}
              onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
              onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
            />
          </div>
        </div>

        {/* Branch / Warehouse */}
        {isAdmin ? (
          <div className="ssr-field-block" style={{ flex: '1.2 1 230px' }}>
            <label className="ssr-label">Active Branch</label>
            <div className="ssr-input-wrapper">
              <MapPin size={14} className="ssr-input-icon" />
              <select
                className="ssr-select"
                value={filters.warehouse}
                onChange={(e) => handleFilterUpdate('warehouse', e.target.value)}
                style={{ paddingRight: '2.5rem' }}
              >
                <option value="">All Branches</option>
                {warehouses.map(w => (
                  <option key={w.value} value={w.value}>{w.label || w.value}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
            </div>
          </div>
        ) : warehouse ? (
          <div className="ssr-field-block" style={{ flex: '1.2 1 230px' }}>
            <label className="ssr-label">Active Branch</label>
            <div className="ssr-input-wrapper">
              <MapPin size={14} className="ssr-input-icon" />
              <div className="ssr-active-branch-box">
                <span>{warehouse.replace(' - KSPL', '')}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Filter by Customer */}
        <div className="ssr-field-block" style={{ flex: '1.2 1 230px' }}>
          <label className="ssr-label">Filter by Customer</label>
          <div className="ssr-input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
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

        {/* Payment Mode */}
        <div className="ssr-field-block">
          <label className="ssr-label">Payment Mode</label>
          <div className="ssr-input-wrapper">
            <CreditCard size={14} className="ssr-input-icon" />
            <select
              className="ssr-select"
              value={filters.payment_mode}
              onChange={(e) => handleFilterUpdate('payment_mode', e.target.value)}
              style={{ paddingRight: '2.5rem' }}
            >
              <option value="">All Payment Modes</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="InstaPay">InstaPay</option>
              <option value="Credit">Credit Sales</option>
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
          </div>
        </div>

        {/* Reset Button */}
        <button
          className="ssr-btn-reset"
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
            setSearchTerm('');
            setCurrentPage(1);
            fetchReport(reset);
          }}
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
          padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
          color: '#b91c1c', fontSize: '0.85rem', fontWeight: 700
        }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* 3. KPI CARDS GRID (7 CARDS MATCHING REFERENCE SCREENSHOT) */}
      <div className="ssr-kpi-grid">
        {/* Card 1: Total POS Revenue */}
        <div
          className="ssr-kpi-card ssr-card-revenue"
          onClick={() => handleMetricCardClick('', '/#/salesreport')}
        >
          <div className="ssr-kpi-header">
            <div className="ssr-kpi-header-left">
              <div className="ssr-kpi-icon-pill">
                <Coins size={16} />
              </div>
              <span className="ssr-kpi-title">Total POS Revenue</span>
            </div>
            <span className="ssr-kpi-trend" style={{ color: '#16a34a' }}>
              <TrendingUp size={15} />
            </span>
          </div>
          <div>
            <div className="ssr-kpi-value">
              <DirhamIcon size={16} />
              <span>{breakdown.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="ssr-kpi-subtext">
              Net Total: {breakdown.net_total.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Card 2: Cash Payments */}
        <div
          className="ssr-kpi-card ssr-card-cash"
          onClick={() => handleMetricCardClick('Cash', '/#/salesreport?payment_mode=Cash')}
        >
          <div className="ssr-kpi-header">
            <div className="ssr-kpi-header-left">
              <div className="ssr-kpi-icon-pill">
                <DollarSign size={16} />
              </div>
              <span className="ssr-kpi-title">Cash Payments</span>
            </div>
            <span className="ssr-kpi-trend" style={{ color: '#16a34a' }}>
              <TrendingUp size={15} />
            </span>
          </div>
          <div>
            <div className="ssr-kpi-value" style={{ color: '#047857' }}>
              <DirhamIcon size={16} />
              <span>{breakdown.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="ssr-kpi-subtext">
              Physical Cash Sales
            </div>
          </div>
        </div>

        {/* Card 3: Card Payments */}
        <div
          className="ssr-kpi-card ssr-card-card"
          onClick={() => handleMetricCardClick('Card', '/#/salesreport?payment_mode=Card')}
        >
          <div className="ssr-kpi-header">
            <div className="ssr-kpi-header-left">
              <div className="ssr-kpi-icon-pill">
                <CreditCard size={16} />
              </div>
              <span className="ssr-kpi-title">Card Payments</span>
            </div>
            <span className="ssr-kpi-trend" style={{ color: '#7c3aed' }}>
              <Minus size={15} />
            </span>
          </div>
          <div>
            <div className="ssr-kpi-value" style={{ color: '#6d28d9' }}>
              <DirhamIcon size={16} />
              <span>{breakdown.card.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="ssr-kpi-subtext">
              Credit &amp; Debit Cards
            </div>
          </div>
        </div>

        {/* Card 4: InstaPay Payments */}
        <div
          className="ssr-kpi-card ssr-card-instapay"
          onClick={() => handleMetricCardClick('InstaPay', '/#/salesreport?payment_mode=InstaPay')}
        >
          <div className="ssr-kpi-header">
            <div className="ssr-kpi-header-left">
              <div className="ssr-kpi-icon-pill">
                <ArrowRightLeft size={16} />
              </div>
              <span className="ssr-kpi-title">Instapay Payments</span>
            </div>
            <span className="ssr-kpi-trend" style={{ color: '#0891b2' }}>
              <Minus size={15} />
            </span>
          </div>
          <div>
            <div className="ssr-kpi-value" style={{ color: '#0e7490' }}>
              <DirhamIcon size={16} />
              <span>{(breakdown.instapay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="ssr-kpi-subtext">
              InstaPay Transactions
            </div>
          </div>
        </div>

        {/* Card 5: Credit Sales */}
        <div
          className="ssr-kpi-card ssr-card-credit"
          onClick={() => handleMetricCardClick('Credit', '/#/salesreport?payment_mode=Credit')}
        >
          <div className="ssr-kpi-header">
            <div className="ssr-kpi-header-left">
              <div className="ssr-kpi-icon-pill">
                <Coins size={16} />
              </div>
              <span className="ssr-kpi-title">Credit Sales</span>
            </div>
            <span className="ssr-kpi-trend" style={{ color: '#d97706' }}>
              <Minus size={15} />
            </span>
          </div>
          <div>
            <div className="ssr-kpi-value" style={{ color: '#b45309' }}>
              <DirhamIcon size={16} />
              <span>{(breakdown.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="ssr-kpi-subtext">
              Outstanding Credit Sales
            </div>
          </div>
        </div>

        {/* Card 6: Loyalty Points Redeemed */}
        <div className="ssr-kpi-card ssr-card-loyalty">
          <div className="ssr-kpi-header">
            <div className="ssr-kpi-header-left">
              <div className="ssr-kpi-icon-pill">
                <Gift size={16} />
              </div>
              <span className="ssr-kpi-title">Loyalty Points Redeemed</span>
            </div>
            <span className="ssr-kpi-trend" style={{ color: '#db2777' }}>
              <Minus size={15} />
            </span>
          </div>
          <div>
            <div className="ssr-kpi-value" style={{ color: '#be185d' }}>
              <DirhamIcon size={16} />
              <span>{(breakdown.loyalty_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="ssr-kpi-subtext">
              Customer Points Redeemed Value
            </div>
          </div>
        </div>

        {/* Card 7: Total Discounts Given */}
        <div className="ssr-kpi-card ssr-card-discounts">
          <div className="ssr-kpi-header">
            <div className="ssr-kpi-header-left">
              <div className="ssr-kpi-icon-pill">
                <Percent size={16} />
              </div>
              <span className="ssr-kpi-title">Total Discounts Given</span>
            </div>
            <span className="ssr-kpi-trend" style={{ color: '#dc2626' }}>
              <Minus size={15} />
            </span>
          </div>
          <div>
            <div className="ssr-kpi-value" style={{ color: '#991b1b' }}>
              <DirhamIcon size={16} />
              <span>{(breakdown.discount_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="ssr-kpi-subtext">
              Customer Price Discounts
            </div>
          </div>
        </div>
      </div>

      {/* 4. TABLE SECTION ("SALES TRANSACTIONS") */}
      <div className="ssr-table-card">
        <div className="ssr-table-header">
          <div className="ssr-table-title-group">
            <h2 className="ssr-table-heading">
              <FileText size={18} color="#2563eb" />
              Sales Transactions
            </h2>
            <p className="ssr-table-subtitle">
              Found <b>{filteredData.length}</b> records matching sequence
            </p>
          </div>

          <div className="ssr-table-search-box no-print">
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              className="ssr-table-search-input"
              placeholder="Search invoice, customer, cashier..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="ssr-table-wrapper">
          <table className="ssr-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input type="checkbox" style={{ borderRadius: '4px', cursor: 'pointer' }} />
                </th>
                {columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).map((col) => (
                  <th key={col.id} style={{ width: col.width, minWidth: col.width, textAlign: col.align }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && data.length === 0 ? (
                <tr>
                  <td colSpan={(columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).length || 1) + 1} style={{ textAlign: 'center', padding: '5rem 0' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: '#2563eb' }} />
                    <p style={{ marginTop: '1rem', fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Processing Data Streams...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={(columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).length || 1) + 1} style={{ textAlign: 'center', padding: '5rem 0', color: '#94a3b8' }}>
                    <FileText size={40} style={{ margin: '0 auto 0.5rem auto', opacity: 0.3 }} />
                    <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>No transactions found for the selected criteria.</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" style={{ borderRadius: '4px', cursor: 'pointer' }} />
                    </td>
                    {columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).map((col) => {
                      const fieldname = col.original.fieldname;
                      const cellValue = row[fieldname];
                      const isMode = fieldname === 'payment_mode' || fieldname === 'mode_of_payment';

                      return (
                        <td
                          key={col.id}
                          style={{
                            textAlign: col.align,
                            fontFamily: col.original.fieldtype === 'Currency' || col.original.fieldtype === 'Float' || fieldname.includes('date') || fieldname.includes('time') ? 'monospace' : 'inherit',
                            fontWeight: col.original.fieldtype === 'Currency' || col.original.fieldtype === 'Float' ? 800 : 600,
                            width: col.width,
                            minWidth: col.width
                          }}
                          title={String(cellValue ?? '')}
                        >
                          {cellValue !== null && cellValue !== undefined ? (
                            isMode ? (
                              formatPaymentPill(cellValue)
                            ) : (fieldname === 'name' || fieldname === 'voucher_no') ? (
                              <span
                                onClick={() => navigate('/salesinvoicelist', { state: { search: cellValue } })}
                                style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                {String(cellValue).replace(' - KSPL', '')}
                                <ExternalLink size={12} color="#3b82f6" />
                              </span>
                            ) : fieldname === 'item_code' ? (
                              <span
                                onClick={() => navigate('/itemlist', { state: { search: cellValue } })}
                                style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                {String(cellValue).replace(' - KSPL', '')}
                                <ExternalLink size={12} color="#3b82f6" />
                              </span>
                            ) : typeof cellValue === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('amount')) ? (
                              cellValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            ) : (
                              String(cellValue).replace(' - KSPL', '')
                            )
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

        {/* Table Footer / Pagination */}
        <div className="ssr-table-footer no-print">
          <div className="ssr-page-size-selector">
            <select
              className="ssr-select-sm"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>per page</span>
          </div>

          <div className="ssr-pagination">
            <button
              className="ssr-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="ssr-page-btn active">{currentPage}</span>
            <button
              className="ssr-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
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