import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Loader2, FileText, AlertCircle, Calendar, Search,
  Filter, Palette, RefreshCw, Download, Printer,
  ChevronDown, Boxes, Layers, Package, TrendingUp, TrendingDown, DollarSign,
  Settings, Activity, ExternalLink
} from 'lucide-react';
import { db } from '../../db';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './StockLedgerReport.css';

const getVoucherUrl = (voucherType, voucherNo) => {
  if (!voucherType || !voucherNo) return null;
  const no = encodeURIComponent(voucherNo);
  switch (voucherType) {
    case 'Sales Invoice': return `/salesinvoice?invoice=${no}`;
    case 'Purchase Invoice': return `/purchaseinvoicelist?name=${no}`;
    case 'Purchase Receipt': return `/purchasereceiptlist?name=${no}`;
    case 'Delivery Note': return `/deliverynote-details/${no}`;
    case 'Sales Order': return `/salesorder-details/${no}`;
    case 'Stock Entry': return `/stock-entry/${no}`;
    case 'POS Invoice': return `/app/pos-invoice/${no}`;
    default: return `/app/${voucherType.toLowerCase().replace(/ /g, '-')}/${no}`;
  }
};

const DEFAULT_LEDGER_COLUMNS = [
  { id: 'date', label: 'Date', visible: true, width: 120 },
  { id: 'time', label: 'Time', visible: true, width: 100 },
  { id: 'item_code', label: 'Item Code', visible: true, width: 130 },
  { id: 'item_name', label: 'Item Name', visible: true, width: 170 },
  { id: 'warehouse', label: 'Warehouse', visible: true, width: 160 },
  { id: 'voucher_type', label: 'Voucher Type', visible: true, width: 130 },
  { id: 'voucher_no', label: 'Voucher No', visible: true, width: 140 },
  { id: 'in_qty', label: 'In Qty', visible: true, width: 100 },
  { id: 'out_qty', label: 'Out Qty', visible: true, width: 100 },
  { id: 'qty_after_transaction', label: 'Balance Qty', visible: true, width: 110 },
  { id: 'valuation_rate', label: 'Avg Rate', visible: true, width: 120 },
  { id: 'stock_value', label: 'Amount', visible: true, width: 130 },
  { id: 'stock_value_difference', label: 'Value Change', visible: true, width: 130 }
];

function StockLedgerReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Role Validation (Critical Access Control)
  const user_roles = JSON.parse(localStorage.getItem('user_roles') || '[]');
  const isAdmin = user_roles.includes("Administrator") || user_roles.includes("System Manager");

  // Theme Hook
  const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, toggleTheme } = useLegacyTheme();

  // Date helpers
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getDate30DaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  };

  const defaultUserWh = localStorage.getItem('warehouse') || '';

  // ----- URL Query & Filter Initialization -----
  const getInitialFilters = () => {
    const from_date = searchParams.get('from_date') || getDate30DaysAgo();
    const to_date = searchParams.get('to_date') || getTodayDate();
    const valuation_field_type = searchParams.get('valuation_field_type') || 'Currency';

    let item_code = '';
    const itemCodeParam = searchParams.get('item_code');
    if (itemCodeParam) {
      try {
        if (itemCodeParam.startsWith('[') && itemCodeParam.endsWith(']')) {
          const parsed = JSON.parse(itemCodeParam);
          if (Array.isArray(parsed) && parsed.length > 0) {
            item_code = parsed[0];
          }
        } else {
          item_code = itemCodeParam;
        }
      } catch (e) {
        item_code = itemCodeParam;
      }
    }

    // Role-based warehouse fallback
    let warehouse = searchParams.get('warehouse') || defaultUserWh;
    let all_warehouses = false;

    if (isAdmin) {
      // Admins default to all warehouses if no warehouse specified
      all_warehouses = !searchParams.get('warehouse');
      if (all_warehouses) warehouse = '';
    } else {
      // Cashiers MUST use their assigned warehouse, no exceptions!
      all_warehouses = false;
      warehouse = defaultUserWh;
    }

    return {
      from_date,
      to_date,
      warehouse,
      all_warehouses,
      item_code,
      item_group: searchParams.get('item_group') || '',
      valuation_field_type
    };
  };

  const [filters, setFilters] = useState(getInitialFilters());
  const [warehouses, setWarehouses] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [selectedItemObj, setSelectedItemObj] = useState(null);

  // ----- Column Config -----
  const loadLedgerColumnConfig = () => {
    try {
      const saved = localStorage.getItem('stock_ledger_report_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultIds = DEFAULT_LEDGER_COLUMNS.map(c => c.id);
        const savedIds = parsed.map(c => c.id);
        const existing = parsed.filter(c => defaultIds.includes(c.id));
        const missing = DEFAULT_LEDGER_COLUMNS.filter(c => !savedIds.includes(c.id));
        return [...existing, ...missing];
      }
    } catch (e) {
      console.error("Ledger Column Config Error:", e);
    }
    return DEFAULT_LEDGER_COLUMNS;
  };

  const [ledgerColumns, setLedgerColumns] = useState(loadLedgerColumnConfig());
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (updated) => {
    setLedgerColumns(updated);
    localStorage.setItem('stock_ledger_report_columns', JSON.stringify(updated));
  };

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  // Fetch initial dropdown items, resolve pre-selected item, and fetch report
  useEffect(() => {
    fetchWarehousesAndGroups();

    // Resolve item details if item_code is passed via URL query
    if (filters.item_code) {
      resolveInitialItem(filters.item_code);
    }

    fetchReport(filters);
  }, []);

  const resolveInitialItem = async (code) => {
    try {
      const dbItem = await db.items.get(code);
      if (dbItem) {
        setSelectedItemObj({ name: dbItem.id, item_name: dbItem.name || dbItem.id });
      } else {
        setSelectedItemObj({ name: code, item_name: code });
      }
    } catch (e) {
      setSelectedItemObj({ name: code, item_name: code });
    }
  };

  const fetchWarehousesAndGroups = async () => {
    try {
      // 1. Fetch Warehouses
      const whRes = await fetch(`${API_PATH}.get_company_warehouses`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include',
      });
      if (whRes.ok) {
        const json = await whRes.json();
        const allWhs = json.message || [];

        if (!isAdmin) {
          // Cashier: restrict list to only their login warehouse
          const cashierWh = (defaultUserWh || '').toLowerCase();
          const filteredWhs = allWhs.filter(wh =>
            wh.name.toLowerCase() === cashierWh ||
            (wh.warehouse_name && wh.warehouse_name.toLowerCase() === cashierWh)
          );

          if (filteredWhs.length === 0 && defaultUserWh) {
            setWarehouses([{ name: defaultUserWh, warehouse_name: defaultUserWh.replace(' - KSPL', '') }]);
          } else {
            setWarehouses(filteredWhs);
          }
        } else {
          setWarehouses(allWhs);
        }
      }

      // 2. Fetch Item Groups
      const groupRes = await fetch(`${API_PATH}.get_item_groups`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include',
      });
      if (groupRes.ok) {
        const json = await groupRes.json();
        const payload = json.message || json;
        if (payload && Array.isArray(payload.data)) {
          setItemGroups(payload.data);
        } else if (Array.isArray(payload)) {
          setItemGroups(payload);
        } else {
          setItemGroups([]);
        }
      }
    } catch (err) {
      console.error('Initial data fetch error:', err);
    }
  };

  const fetchReport = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        from_date: activeFilters.from_date,
        to_date: activeFilters.to_date,
        valuation_field_type: activeFilters.valuation_field_type || 'Currency'
      };

      // Strict Access Enforcement: Overrule anything if not admin
      if (!isAdmin) {
        payload.warehouse = defaultUserWh;
      } else {
        if (!activeFilters.all_warehouses && activeFilters.warehouse) {
          payload.warehouse = activeFilters.warehouse;
        }
      }

      if (activeFilters.item_group) {
        payload.item_group = activeFilters.item_group;
      }

      if (activeFilters.item_code) {
        payload.item_code = JSON.stringify([activeFilters.item_code]);
      }

      const params = new URLSearchParams(payload);
      const res = await fetch(`${API_PATH}.get_stock_ledger_report?${params.toString()}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const payloadData = result.message || result;

      if (payloadData.status === 'success' || (payloadData.columns && payloadData.data)) {
        setData(payloadData.data || []);
        setSuccess('Report generated successfully');
      } else {
        setError(payloadData.message || payloadData.error || 'Failed to fetch report data');
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

  const handleAllWarehousesToggle = (checked) => {
    if (!isAdmin) return; // Cashiers cannot toggle all warehouses
    const next = {
      ...filters,
      all_warehouses: checked,
      warehouse: checked ? '' : (defaultUserWh || (warehouses[0]?.name || ''))
    };
    setFilters(next);
    fetchReport(next);
  };

  // Search Items dynamically from Dexie and fall back to API
  const fetchItemsAPI = async (query) => {
    try {
      const term = query.toLowerCase();
      let results = await db.items
        .filter(it =>
          (it.name || '').toLowerCase().includes(term) ||
          (it.id || '').toLowerCase().includes(term)
        )
        .limit(15)
        .toArray();

      let formatted = results.map(it => ({
        name: it.id,
        item_name: it.name || it.id
      }));

      if (formatted.length < 5 && query.length >= 2) {
        const res = await fetch(`${API_PATH}.get_items`, {
          headers: { 'X-Frappe-SID': getSession() },
          credentials: 'include'
        });
        if (res.ok) {
          const json = await res.json();
          const online = json.message || [];
          const filteredOnline = online.filter(it =>
            (it.item_code || '').toLowerCase().includes(term) ||
            (it.item_name || '').toLowerCase().includes(term)
          ).slice(0, 15);

          const existingCodes = new Set(formatted.map(x => x.name));
          filteredOnline.forEach(it => {
            if (!existingCodes.has(it.item_code)) {
              formatted.push({ name: it.item_code, item_name: it.item_name || it.item_code });
            }
          });
        }
      }
      return formatted;
    } catch (err) {
      console.error('Fetch items error:', err);
      return [];
    }
  };

  // Metric Calculation Helpers
  const totalInQty = data.reduce((sum, row) => sum + (parseFloat(row.in_qty) || 0), 0);
  const totalOutQty = data.reduce((sum, row) => sum + (parseFloat(row.out_qty) || 0), 0);
  const totalValChange = data.reduce((sum, row) => sum + (parseFloat(row.stock_value_difference) || 0), 0);
  const finalBalQty = data.length > 0 ? parseFloat(data[data.length - 1].qty_after_transaction) || 0 : 0;
  const finalBalVal = data.length > 0 ? parseFloat(data[data.length - 1].stock_value) || 0 : 0;

  // CSV Export
  const exportCSV = () => {
    if (data.length === 0) return;
    const activeCols = ledgerColumns.filter(c => c.visible);
    const headers = activeCols.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row => {
      return activeCols.map(col => {
        let val = '';
        if (col.id === 'date') val = row.date ? row.date.replace('T', ' ').substring(0, 10) : '';
        else if (col.id === 'time') val = row.date ? row.date.replace('T', ' ').substring(11, 19) : '';
        else if (col.id === 'item_code') val = row.item_code;
        else if (col.id === 'item_name') val = row.item_name;
        else if (col.id === 'warehouse') val = row.warehouse;
        else if (col.id === 'voucher_type') val = row.voucher_type;
        else if (col.id === 'voucher_no') val = row.voucher_no;
        else if (col.id === 'in_qty') val = row.in_qty;
        else if (col.id === 'out_qty') val = row.out_qty;
        else if (col.id === 'qty_after_transaction') val = row.qty_after_transaction;
        else if (col.id === 'valuation_rate') val = row.valuation_rate;
        else if (col.id === 'stock_value') val = row.stock_value;
        else if (col.id === 'stock_value_difference') val = row.stock_value_difference;

        const stringVal = val !== null && val !== undefined ? String(val) : '';
        return `"${stringVal.replace(/"/g, '""')}"`;
      }).join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Ledger_${filters.from_date}_to_${filters.to_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="so-page stock-ledger-report-container" style={{ padding: 0 }}>

      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header" style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Package size={22} style={{ color: themeColor || '#0082f6' }} strokeWidth={2.5} />
            <span style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
              STOCK LEDGER REPORT
            </span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
            Chronological ledger of inventory logs, rates, incoming receipts and valuations
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
            onClick={() => setShowColConfig(true)}
          >
            <Settings size={14} /> CUSTOMIZE COLUMNS
          </button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 16px', height: '38px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 800, color: '#475569', cursor: 'pointer', textTransform: 'uppercase' }}
            onClick={() => window.print()}
          >
            <Printer size={14} /> PRINT
          </button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0 16px', height: '38px', background: themeColor || '#0082f6', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 800, color: '#ffffff', cursor: 'pointer', textTransform: 'uppercase' }}
            onClick={exportCSV}
          >
            <Download size={14} /> EXPORT CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        <div className="so-layout">

          {/* 2. SUMMARY METRIC CARDS */}
          <div className="metrics-grid">
            <div className="metric-card balance">
              <div className="metric-icon-box" style={{ background: themeColor + '15', color: themeColor }}>
                <Boxes size={22} />
              </div>
              <div className="metric-info">
                <h3>Closing Qty</h3>
                <p className="metric-value">{finalBalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</p>
                <span className="metric-sub">Latest Ledger Units</span>
              </div>
            </div>

            <div className="metric-card value">
              <div className="metric-icon-box" style={{ background: '#10b98115', color: '#10b981' }}>
                <DollarSign size={22} />
              </div>
              <div className="metric-info">
                <h3 className="flex items-center gap-1">Closing Value (<DirhamIcon size={12} />)</h3>
                <p className="metric-value flex items-center justify-center gap-1.5"><DirhamIcon size={22} /> {finalBalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <span className="metric-sub">Latest Valuation Balance</span>
              </div>
            </div>

            <div className="metric-card inbound">
              <div className="metric-icon-box" style={{ background: '#3b82f615', color: '#3b82f6' }}>
                <TrendingUp size={22} />
              </div>
              <div className="metric-info">
                <h3>Total Inward</h3>
                <p className="metric-value">+{totalInQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} Units</p>
                <span className="metric-sub">Sum of incoming transactions</span>
              </div>
            </div>

            <div className="metric-card outbound">
              <div className="metric-icon-box" style={{ background: '#f59e0b15', color: '#f59e0b' }}>
                <TrendingDown size={22} />
              </div>
              <div className="metric-info">
                <h3>Total Outward</h3>
                <p className="metric-value">-{Math.abs(totalOutQty).toLocaleString(undefined, { maximumFractionDigits: 3 })} Units</p>
                <span className="metric-sub">Sum of outgoing transactions</span>
              </div>
            </div>
          </div>

          {/* 3. DYNAMIC HORIZONTAL FILTERS */}
          <div className="filters-wrapper">
            <div className="filter-input-field flex-2">
              <label className="so-filter-label">From Date</label>
              <div className="so-relative">
                <Calendar size={14} className="input-icon" style={{ color: themeColor }} />
                <input
                  type="date"
                  className="so-filter-input"
                  value={filters.from_date}
                  onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                  onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                />
              </div>
            </div>

            <div className="filter-input-field flex-2">
              <label className="so-filter-label">To Date</label>
              <div className="so-relative">
                <Calendar size={14} className="input-icon" style={{ color: themeColor }} />
                <input
                  type="date"
                  className="so-filter-input"
                  value={filters.to_date}
                  onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                  onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                  onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                />
              </div>
            </div>

            <div className="filter-input-field flex-3">
              <label className="so-filter-label">Filter by Product</label>
              <div className="so-relative dropdown-search-container">
                <CustomSearchDropdown
                  placeholder="Search Product..."
                  value={selectedItemObj}
                  onSelect={(item) => {
                    setSelectedItemObj(item);
                    handleFilterUpdate('item_code', item ? item.name : '');
                  }}
                  fetchData={fetchItemsAPI}
                  optionsLabel="item_name"
                />
              </div>
            </div>

            <div className="filter-input-field flex-3">
              <label className="so-filter-label">Item Group</label>
              <div className="so-relative">
                <Layers size={14} className="input-icon" style={{ color: '#94a3b8' }} />
                <select
                  className="so-filter-select"
                  value={filters.item_group}
                  onChange={(e) => handleFilterUpdate('item_group', e.target.value)}
                >
                  <option value="">All Item Groups</option>
                  {itemGroups.map((grp, index) => (
                    <option key={grp.value || grp.name || index} value={grp.value || grp.name}>
                      {grp.label || grp.item_group_name || grp.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-arrow" />
              </div>
            </div>

            <div className="filter-input-field flex-3">
              <div className="warehouse-filter-header">
                <label className="so-filter-label">Target Warehouse</label>
                <label className={`all-warehouses-checkbox ${!isAdmin ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={filters.all_warehouses}
                    disabled={!isAdmin}
                    onChange={(e) => handleAllWarehousesToggle(e.target.checked)}
                  />
                  <span>All Warehouses</span>
                </label>
              </div>
              <div className="so-relative">
                <Boxes size={14} className="input-icon" style={{ color: filters.all_warehouses ? '#cbd5e1' : themeColor }} />
                <select
                  className="so-filter-select"
                  value={filters.warehouse}
                  disabled={filters.all_warehouses || !isAdmin}
                  onChange={(e) => handleFilterUpdate('warehouse', e.target.value)}
                  style={{ opacity: (filters.all_warehouses || !isAdmin) ? 0.6 : 1 }}
                >
                  {warehouses.map(wh => (
                    <option key={wh.name} value={wh.name}>{wh.warehouse_name || wh.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-arrow" />
              </div>
            </div>

            <button
              className="so-clear-btn"
              onClick={() => {
                const reset = {
                  from_date: getDate30DaysAgo(),
                  to_date: getTodayDate(),
                  warehouse: defaultUserWh,
                  all_warehouses: isAdmin ? !defaultUserWh : false,
                  item_code: '',
                  item_group: '',
                  valuation_field_type: 'Currency'
                };
                setSelectedItemObj(null);
                setFilters(reset);
                fetchReport(reset);
              }}
            >
              Reset
            </button>
          </div>

          {/* 4. CONTENT VIEWPORT */}
          <main className="stock-table-viewport">
            {error && (
              <div className="report-error-banner">
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <div className="results-header">
              <p className="so-list-meta">Found <b>{data.length}</b> ledger rows</p>
              {loading && (
                <div className="loading-indicator" style={{ color: themeColor }}>
                  <Loader2 size={16} className="animate-spin" /> RUNNING LEDGER CALCULATION...
                </div>
              )}
            </div>

            <div className="so-table-card table-outer-box">
              <div className="so-table-wrapper scrollable-table-area">
                <table className="so-table premium-stock-table">
                  <thead>
                    <tr>
                      {ledgerColumns.filter(c => c.visible).map(col => (
                        <th
                          key={col.id}
                          style={{
                            width: col.width,
                            minWidth: col.width,
                            textAlign: ['in_qty', 'out_qty', 'qty_after_transaction', 'valuation_rate', 'stock_value', 'stock_value_difference'].includes(col.id) ? 'right' : 'left'
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && data.length === 0 ? (
                      <tr>
                        <td colSpan={ledgerColumns.filter(c => c.visible).length} className="so-empty" style={{ padding: '6rem 0' }}>
                          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                          <p className="loading-text">Rebuilding Stock Ledger...</p>
                        </td>
                      </tr>
                    ) : data.length === 0 ? (
                      <tr>
                        <td colSpan={ledgerColumns.filter(c => c.visible).length} className="so-empty" style={{ padding: '6rem 0' }}>
                          <div className="empty-state-icon">
                            <FileText size={48} />
                          </div>
                          <p className="empty-state-text">No ledger entries match the criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      data.map((row, idx) => {
                        const inQty = parseFloat(row.in_qty) || 0;
                        const outQty = parseFloat(row.out_qty) || 0;
                        const balQty = parseFloat(row.qty_after_transaction) || 0;
                        const valRate = parseFloat(row.valuation_rate) || 0;
                        const stockVal = parseFloat(row.stock_value) || 0;
                        const valDiff = parseFloat(row.stock_value_difference) || 0;

                        // Display customized special columns
                        return (
                          <tr key={idx} className="table-row-hover">
                            {ledgerColumns.filter(c => c.visible).map(col => {
                              switch (col.id) {
                                case 'date':
                                  return (
                                    <td key={col.id} style={{ fontWeight: 500 }}>
                                      {row.date ? row.date.replace('T', ' ').substring(0, 10) : ''}
                                    </td>
                                  );
                                case 'time':
                                  return (
                                    <td key={col.id} style={{ fontWeight: 500, color: '#64748b', fontFamily: 'monospace', fontSize: '11px' }}>
                                      {row.date ? row.date.replace('T', ' ').substring(11, 19) : ''}
                                    </td>
                                  );
                                case 'item_code':
                                  return (
                                    <td key={col.id} className="item-code-cell">
                                      <span onClick={() => navigate('/itemlist', { state: { search: row.item_code } })} className="code-capsule group flex items-center gap-1.5 w-fit hover:text-indigo-600 transition-colors cursor-pointer">
                                        {row.item_code}
                                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </span>
                                    </td>
                                  );
                                case 'item_name':
                                  return (
                                    <td key={col.id} className="item-name-cell">{row.item_name}</td>
                                  );
                                case 'warehouse':
                                  return (
                                    <td key={col.id} className="warehouse-cell">
                                      <span className="warehouse-name">{row.warehouse}</span>
                                    </td>
                                  );
                                case 'voucher_type':
                                  return (
                                    <td key={col.id}><span className="badge-item-group">{row.voucher_type}</span></td>
                                  );
                                case 'voucher_no':
                                  const url = getVoucherUrl(row.voucher_type, row.voucher_no);
                                  const isExternal = url && url.startsWith('/app/');
                                  return (
                                    <td key={col.id} style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                                      {url ? (
                                        isExternal ? (
                                          <a href={url} target={window.location.protocol === 'file:' ? '_self' : '_blank'} rel="noopener noreferrer" className="group flex items-center gap-1.5 hover:text-indigo-600 transition-colors underline-offset-4 hover:underline cursor-pointer">
                                            {row.voucher_no}
                                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                          </a>
                                        ) : (
                                          <span onClick={() => navigate(url)} className="group flex items-center gap-1.5 hover:text-indigo-600 transition-colors underline-offset-4 hover:underline cursor-pointer">
                                            {row.voucher_no}
                                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                          </span>
                                        )
                                      ) : (
                                        row.voucher_no
                                      )}
                                    </td>
                                  );
                                case 'in_qty':
                                  return (
                                    <td key={col.id} style={{ textAlign: 'right' }}>
                                      {inQty > 0 ? (
                                        <span className="qty-badge-pill incoming">
                                          +{inQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                        </span>
                                      ) : (
                                        <span className="text-muted-zero">-</span>
                                      )}
                                    </td>
                                  );
                                case 'out_qty':
                                  return (
                                    <td key={col.id} style={{ textAlign: 'right' }}>
                                      {outQty < 0 || outQty > 0 ? (
                                        <span className="qty-badge-pill outgoing">
                                          -{Math.abs(outQty).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                        </span>
                                      ) : (
                                        <span className="text-muted-zero">-</span>
                                      )}
                                    </td>
                                  );
                                case 'qty_after_transaction':
                                  return (
                                    <td key={col.id} style={{ textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                                      {balQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                    </td>
                                  );
                                case 'valuation_rate':
                                  return (
                                    <td key={col.id} style={{ textAlign: 'right', color: '#64748b' }}>
                                      <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} className="text-slate-400" /> {valRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </td>
                                  );
                                case 'stock_value':
                                  return (
                                    <td key={col.id} style={{ textAlign: 'right', fontWeight: 800, color: themeColor }}>
                                      <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} style={{ color: themeColor }} /> {stockVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </td>
                                  );
                                case 'stock_value_difference':
                                  return (
                                    <td key={col.id} style={{ textAlign: 'right', fontWeight: 600 }}>
                                      <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} className="text-slate-400" />
                                        <span className="curr-val" style={{ color: valDiff > 0 ? '#047857' : valDiff < 0 ? '#b91c1c' : '#334155' }}>
                                          {valDiff > 0 ? '+' : ''}{valDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span></span>
                                    </td>
                                  );
                                default:
                                  return null;
                              }
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Column Customization Modal */}
      <ColumnConfigModal
        isOpen={showColConfig}
        onClose={() => setShowColConfig(false)}
        config={ledgerColumns}
        onUpdate={handleColConfigUpdate}
        doctype="Stock Ledger"
        themeColor={themeColor}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .stock-ledger-report-container {
          --primary-color: ${themeColor};
          --primary-color-hover: ${themeColorHover};
          --primary-light: ${themeLight};
        }
      `}} />
    </div>
  );
}

export default StockLedgerReport;
