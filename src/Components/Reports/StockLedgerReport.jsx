import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Loader2, FileText, AlertCircle, Calendar, Search,
  Filter, Palette, RefreshCw, Download, Printer,
  ChevronDown, Boxes, Layers, Package, TrendingUp, TrendingDown, DollarSign,
  Settings, Activity, ExternalLink, ChevronLeft, ChevronRight
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
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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
    <div className="erp-page slr-container">

      {/* 1. Header */}
      <header className="slr-header no-print">
        <div className="slr-header-title-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="slr-icon-badge">
              <Package size={22} className="stroke-[2.5]" />
            </div>
            <h1 className="slr-title">STOCK LEDGER REPORT</h1>
            <span className="slr-tag">Audit Ledger</span>
          </div>
          <p className="slr-subtitle">Chronological ledger of inventory logs, rates, incoming receipts and valuations</p>
        </div>

        <div className="slr-actions">
          <button onClick={() => window.print()} className="erp-button erp-button-secondary slr-btn-secondary">
            <Printer size={15} />
            <span>Print</span>
          </button>
          <button onClick={exportCSV} className="erp-button erp-button-primary slr-btn-primary">
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            className="slr-btn-icon"
            onClick={() => setShowColConfig(true)}
            title="Configure Columns"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => fetchReport(filters)}
            disabled={loading}
            className="slr-btn-icon"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Print Only Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6 p-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock Ledger Report</h1>
            <p className="text-xs text-slate-600 mt-1">Chronological Stock Audit & Movement Log</p>
          </div>
          <div className="text-right text-xs font-bold text-slate-700">
            <div><b>Period:</b> {filters.from_date} to {filters.to_date}</div>
            <div><b>Warehouse:</b> {filters.all_warehouses ? 'All Warehouses' : (filters.warehouse || 'All')}</div>
          </div>
        </div>
      </div>

      <main className="slr-main-body">

        {/* 2. KPI Metrics Summary */}
        <div className="slr-kpi-grid">
          <div className="slr-kpi-card emerald">
            <div className="slr-kpi-header">
              <div className="slr-kpi-header-left">
                <div className="slr-kpi-icon-pill">
                  <Boxes size={18} />
                </div>
                <span className="slr-kpi-title">Closing Qty</span>
              </div>
            </div>
            <div>
              <div className="slr-kpi-value">
                <span>{finalBalQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
              </div>
              <div className="slr-kpi-subtext">Latest Ledger Units</div>
            </div>
          </div>

          <div className="slr-kpi-card blue">
            <div className="slr-kpi-header">
              <div className="slr-kpi-header-left">
                <div className="slr-kpi-icon-pill">
                  <DollarSign size={18} />
                </div>
                <span className="slr-kpi-title">Closing Value</span>
              </div>
            </div>
            <div>
              <div className="slr-kpi-value">
                <DirhamIcon size={18} />
                <span>{finalBalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="slr-kpi-subtext">Latest Valuation Balance</div>
            </div>
          </div>

          <div className="slr-kpi-card purple">
            <div className="slr-kpi-header">
              <div className="slr-kpi-header-left">
                <div className="slr-kpi-icon-pill">
                  <TrendingUp size={18} />
                </div>
                <span className="slr-kpi-title">Total Inward</span>
              </div>
            </div>
            <div>
              <div className="slr-kpi-value">
                <span>+{totalInQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Units</span>
              </div>
              <div className="slr-kpi-subtext">Sum of incoming transactions</div>
            </div>
          </div>

          <div className="slr-kpi-card amber">
            <div className="slr-kpi-header">
              <div className="slr-kpi-header-left">
                <div className="slr-kpi-icon-pill">
                  <TrendingDown size={18} />
                </div>
                <span className="slr-kpi-title">Total Outward</span>
              </div>
            </div>
            <div>
              <div className="slr-kpi-value">
                <span>-{Math.abs(totalOutQty).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Units</span>
              </div>
              <div className="slr-kpi-subtext">Sum of outgoing transactions</div>
            </div>
          </div>
        </div>

        {/* 3. Filters Card */}
        <div className="erp-filter-bar slr-filter-card no-print">
          <div className="slr-filter-inputs">
            {/* From Date */}
            <div className="slr-field-block">
              <label className="slr-label">
                <Calendar size={12} color="#2563eb" />
                From Date
              </label>
              <input
                type="date"
                className="slr-input"
                value={filters.from_date}
                onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            {/* To Date */}
            <div className="slr-field-block">
              <label className="slr-label">
                <Calendar size={12} color="#2563eb" />
                To Date
              </label>
              <input
                type="date"
                className="slr-input"
                value={filters.to_date}
                onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            {/* Filter by Product */}
            <div className="slr-field-block" style={{ flex: '1.5 1 220px' }}>
              <label className="slr-label">
                <Search size={12} color="#2563eb" />
                Filter by Product
              </label>
              <div style={{ position: 'relative' }}>
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

            {/* Item Group */}
            <div className="slr-field-block" style={{ flex: '1 1 180px' }}>
              <label className="slr-label">
                <Layers size={12} />
                Item Group
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  className="slr-select"
                  value={filters.item_group}
                  onChange={(e) => handleFilterUpdate('item_group', e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                >
                  <option value="">All Item Groups</option>
                  {itemGroups.map((grp, index) => (
                    <option key={grp.value || grp.name || index} value={grp.value || grp.name}>
                      {grp.label || grp.item_group_name || grp.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>

            {/* Target Warehouse */}
            <div className="slr-field-block" style={{ flex: '1.2 1 200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="slr-label">
                  <Boxes size={12} color="#2563eb" />
                  Target Warehouse
                </label>
                {isAdmin && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filters.all_warehouses}
                      disabled={!isAdmin}
                      onChange={(e) => handleAllWarehousesToggle(e.target.checked)}
                    />
                    <span>All</span>
                  </label>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <select
                  className="slr-select"
                  value={filters.warehouse}
                  disabled={filters.all_warehouses || !isAdmin}
                  onChange={(e) => handleFilterUpdate('warehouse', e.target.value)}
                  style={{ opacity: (filters.all_warehouses || !isAdmin) ? 0.6 : 1, paddingRight: '2.5rem' }}
                >
                  {warehouses.map(wh => (
                    <option key={wh.name} value={wh.name}>{wh.warehouse_name || wh.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>
          </div>

          <button
            className="slr-btn-reset"
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

        {/* Error Banner */}
        {error && (
          <div style={{ padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 'bold' }}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* 4. Table Viewport */}
        <div className="erp-table-scroll slr-table-container">
          <div className="slr-table-header-meta">
            <span className="slr-meta-text">Found <b>{data.length}</b> stock ledger rows</span>
            {loading && (
              <span className="slr-meta-text flex items-center gap-2" style={{ color: '#2563eb' }}>
                <Loader2 size={15} className="animate-spin" /> Calculating ledger...
              </span>
            )}
          </div>

          <div className="erp-table-scroll slr-table-wrapper">
            <table className="erp-table slr-table">
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
                    <td colSpan={ledgerColumns.filter(c => c.visible).length} style={{ textAlign: 'center', padding: '5rem 0', color: '#64748b' }}>
                      <Loader2 size={32} className="animate-spin mx-auto mb-2 text-blue-600" />
                      <p className="font-bold text-sm">Rebuilding Stock Ledger...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={ledgerColumns.filter(c => c.visible).length} style={{ textAlign: 'center', padding: '5rem 0', color: '#64748b' }}>
                      <FileText size={42} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">No ledger entries match the criteria.</p>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const displayData = pageSize === -1 ? data : data.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                    return displayData.map((row, idx) => {
                      const inQty = parseFloat(row.in_qty) || 0;
                      const outQty = parseFloat(row.out_qty) || 0;
                      const balQty = parseFloat(row.qty_after_transaction) || 0;
                      const valRate = parseFloat(row.valuation_rate) || 0;
                      const stockVal = parseFloat(row.stock_value) || 0;
                      const valDiff = parseFloat(row.stock_value_difference) || 0;

                      return (
                        <tr key={idx}>
                          {ledgerColumns.filter(c => c.visible).map(col => {
                            switch (col.id) {
                              case 'date':
                                return (
                                  <td key={col.id} style={{ fontWeight: 600 }}>
                                    {row.date ? row.date.replace('T', ' ').substring(0, 10) : ''}
                                  </td>
                                );
                              case 'time':
                                return (
                                  <td key={col.id} style={{ fontWeight: 600, color: '#64748b', fontFamily: 'monospace', fontSize: '11px' }}>
                                    {row.date ? row.date.replace('T', ' ').substring(11, 19) : ''}
                                  </td>
                                );
                              case 'item_code':
                                return (
                                  <td key={col.id}>
                                    <span onClick={() => navigate('/itemlist', { state: { search: row.item_code } })} className="slr-code-capsule inline-flex items-center gap-1">
                                      {row.item_code}
                                      <ExternalLink size={11} className="opacity-70" />
                                    </span>
                                  </td>
                                );
                              case 'item_name':
                                return (
                                  <td key={col.id} style={{ fontWeight: 700, color: '#0f172a' }}>{row.item_name}</td>
                                );
                              case 'warehouse':
                                return (
                                  <td key={col.id} style={{ color: '#475569' }}>{row.warehouse}</td>
                                );
                              case 'voucher_type':
                                return (
                                  <td key={col.id}><span className="slr-badge-voucher">{row.voucher_type}</span></td>
                                );
                              case 'voucher_no':
                                const url = getVoucherUrl(row.voucher_type, row.voucher_no);
                                const isExternal = url && url.startsWith('/app/');
                                return (
                                  <td key={col.id} style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                                    {url ? (
                                      isExternal ? (
                                        <a href={url} target={window.location.protocol === 'file:' ? '_self' : '_blank'} rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors underline-offset-4 hover:underline cursor-pointer">
                                          {row.voucher_no}
                                          <ExternalLink size={11} className="text-blue-500 opacity-70" />
                                        </a>
                                      ) : (
                                        <span onClick={() => navigate(url)} className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors underline-offset-4 hover:underline cursor-pointer">
                                          {row.voucher_no}
                                          <ExternalLink size={11} className="text-blue-500 opacity-70" />
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
                                      <span className="qty-pill-in">
                                        +{inQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>-</span>
                                    )}
                                  </td>
                                );
                              case 'out_qty':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    {outQty < 0 || outQty > 0 ? (
                                      <span className="qty-pill-out">
                                        -{Math.abs(outQty).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>-</span>
                                    )}
                                  </td>
                                );
                              case 'qty_after_transaction':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                    {balQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                  </td>
                                );
                              case 'valuation_rate':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', color: '#64748b' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <DirhamIcon size={12} style={{ marginRight: '0.35rem' }} />
                                      {valRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                );
                              case 'stock_value':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', fontWeight: 900, color: '#2563eb' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <DirhamIcon size={12} style={{ marginRight: '0.35rem' }} />
                                      {stockVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                );
                              case 'stock_value_difference':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', fontWeight: 600 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <DirhamIcon size={12} style={{ marginRight: '0.35rem' }} />
                                      <span style={{ color: valDiff > 0 ? '#047857' : valDiff < 0 ? '#b91c1c' : '#334155' }}>
                                        {valDiff > 0 ? '+' : ''}{valDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </span>
                                  </td>
                                );
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          {data.length > 0 && (() => {
            const totalPages = pageSize === -1 ? 1 : (Math.ceil(data.length / pageSize) || 1);
            return (
              <div className="ssr-table-footer no-print" style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="ssr-page-size-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                  <select
                    className="ssr-select-sm"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{ height: '32px', padding: '0 0.65rem', background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', outline: 'none' }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={-1}>All</option>
                  </select>
                  <span>per page</span>
                </div>

                <div className="erp-pagination ssr-pagination" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    className="ssr-page-btn"
                    disabled={currentPage <= 1 || pageSize === -1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{ height: '32px', minWidth: '32px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', fontSize: '0.8rem', fontWeight: 700, color: '#475569', cursor: (currentPage <= 1 || pageSize === -1) ? 'not-allowed' : 'pointer', opacity: (currentPage <= 1 || pageSize === -1) ? 0.4 : 1 }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="ssr-page-btn active" style={{ height: '32px', minWidth: '32px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#2563eb', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700 }}>{currentPage}</span>
                  <button
                    className="ssr-page-btn"
                    disabled={currentPage >= totalPages || pageSize === -1}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{ height: '32px', minWidth: '32px', padding: '0 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', fontSize: '0.8rem', fontWeight: 700, color: '#475569', cursor: (currentPage >= totalPages || pageSize === -1) ? 'not-allowed' : 'pointer', opacity: (currentPage >= totalPages || pageSize === -1) ? 0.4 : 1 }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      {/* Column Customization Modal */}
      <ColumnConfigModal
        isOpen={showColConfig}
        onClose={() => setShowColConfig(false)}
        config={ledgerColumns}
        onUpdate={handleColConfigUpdate}
        doctype="Stock Ledger"
        themeColor={themeColor}
      />
    </div>
  );
}

export default StockLedgerReport;
