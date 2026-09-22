import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Loader2, FileText, AlertCircle, Calendar, Search,
  Filter, Palette, RefreshCw, Download, Printer,
  ChevronDown, Boxes, Layers, Package, TrendingUp, TrendingDown, DollarSign,
  Settings, ExternalLink, ChevronLeft, ChevronRight
} from 'lucide-react';
import { db } from '../../db';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './StockBalanceReport.css';

const DEFAULT_STOCK_COLUMNS = [
  { id: 'item_code', label: 'Item Code', visible: true, width: 160 },
  { id: 'item_name', label: 'Item Name', visible: true, width: 240 },
  { id: 'item_group', label: 'Item Group', visible: true, width: 170 },
  { id: 'warehouse', label: 'Warehouse', visible: true, width: 220 },
  { id: 'stock_uom', label: 'UOM', visible: true, width: 110 },
  { id: 'opening_qty', label: 'Opening Qty', visible: true, width: 130 },
  { id: 'opening_val', label: 'Opening Value', visible: true, width: 155 },
  { id: 'in_qty', label: 'In Qty', visible: true, width: 130 },
  { id: 'in_val', label: 'In Value', visible: true, width: 155 },
  { id: 'out_qty', label: 'Out Qty', visible: true, width: 130 },
  { id: 'out_val', label: 'Out Value', visible: true, width: 155 },
  { id: 'bal_qty', label: 'Closing Qty', visible: true, width: 130 },
  { id: 'val_rate', label: 'Valuation Rate', visible: true, width: 145 },
  { id: 'bal_val', label: 'Closing Value', visible: true, width: 165 }
];

function StockBalanceReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // ----- Column Config -----
  const loadStockColumnConfig = () => {
    try {
      const saved = localStorage.getItem('stock_balance_report_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        const defaultIds = DEFAULT_STOCK_COLUMNS.map(c => c.id);
        const savedIds = parsed.map(c => c.id);
        const existing = parsed.filter(c => defaultIds.includes(c.id));
        const missing = DEFAULT_STOCK_COLUMNS.filter(c => !savedIds.includes(c.id));
        return [...existing, ...missing];
      }
    } catch (e) {
      console.error("Stock Column Config Error:", e);
    }
    return DEFAULT_STOCK_COLUMNS;
  };

  const [stockColumns, setStockColumns] = useState(loadStockColumnConfig());
  const [showColConfig, setShowColConfig] = useState(false);

  const handleColConfigUpdate = (updated) => {
    setStockColumns(updated);
    localStorage.setItem('stock_balance_report_columns', JSON.stringify(updated));
  };

  // Theme Hook
  const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, themeHeaderBg, themeHeaderText, toggleTheme } = useLegacyTheme();

  // Date helpers
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getDate30DaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  };

  const [searchParams] = useSearchParams();
  const defaultUserWh = localStorage.getItem('warehouse') || '';

  // Role Validation (Critical Access Control)
  const user_roles = JSON.parse(localStorage.getItem('user_roles') || '[]');
  const isAdmin = user_roles.includes("Administrator") || user_roles.includes("System Manager");

  const getInitialFilters = () => {
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

    return {
      from_date: searchParams.get('from_date') || getDate30DaysAgo(),
      to_date: searchParams.get('to_date') || getTodayDate(),
      warehouse: searchParams.get('warehouse') || defaultUserWh,
      all_warehouses: isAdmin ? !searchParams.get('warehouse') : false,
      item_code,
      item_group: searchParams.get('item_group') || ''
    };
  };

  const [filters, setFilters] = useState(getInitialFilters());

  const [warehouses, setWarehouses] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [selectedItemObj, setSelectedItemObj] = useState(null);

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

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

  useEffect(() => {
    fetchWarehousesAndGroups();

    if (filters.item_code) {
      resolveInitialItem(filters.item_code);
    }

    fetchReport(filters);
  }, []);

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
      const res = await fetch(`${API_PATH}.get_stock_balance_report?${params.toString()}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const payloadData = result.message || result;

      if (payloadData.status === 'success' || (payloadData.columns && payloadData.data)) {
        setData(payloadData.data || []);
        // Set columns dynamically if present, otherwise set our standard columns
        if (payloadData.columns && payloadData.columns.length > 0) {
          setColumns(payloadData.columns);
        } else {
          setColumns([
            { label: 'Item', fieldname: 'item_code' },
            { label: 'Item Name', fieldname: 'item_name' },
            { label: 'Item Group', fieldname: 'item_group' },
            { label: 'Warehouse', fieldname: 'warehouse' },
            { label: 'Stock UOM', fieldname: 'stock_uom' },
            { label: 'Balance Qty', fieldname: 'bal_qty' },
            { label: 'Balance Value', fieldname: 'bal_val' },
            { label: 'Opening Qty', fieldname: 'opening_qty' },
            { label: 'Opening Value', fieldname: 'opening_val' },
            { label: 'In Qty', fieldname: 'in_qty' },
            { label: 'In Value', fieldname: 'in_val' },
            { label: 'Out Qty', fieldname: 'out_qty' },
            { label: 'Out Value', fieldname: 'out_val' },
            { label: 'Valuation Rate', fieldname: 'val_rate' }
          ]);
        }
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
    if (!isAdmin) return; // Non-admins cannot toggle all warehouses
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
      // First, query offline Dexie store
      let results = await db.items
        .filter(it =>
          (it.name || '').toLowerCase().includes(term) ||
          (it.id || '').toLowerCase().includes(term)
        )
        .limit(15)
        .toArray();

      // Convert format for dropdown
      let formatted = results.map(it => ({
        name: it.id,
        item_name: it.name || it.id
      }));

      if (formatted.length < 5 && query.length >= 2) {
        // Query server
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
  const totalClosingQty = data.reduce((sum, row) => sum + (parseFloat(row.bal_qty) || 0), 0);
  const totalClosingValue = data.reduce((sum, row) => sum + (parseFloat(row.bal_val) || 0), 0);
  const totalInQty = data.reduce((sum, row) => sum + (parseFloat(row.in_qty) || 0), 0);
  const totalInValue = data.reduce((sum, row) => sum + (parseFloat(row.in_val) || 0), 0);
  const totalOutQty = data.reduce((sum, row) => sum + (parseFloat(row.out_qty) || 0), 0);
  const totalOutValue = data.reduce((sum, row) => sum + (parseFloat(row.out_val) || 0), 0);

  // CSV Export
  const exportCSV = () => {
    if (data.length === 0) return;
    const activeCols = stockColumns.filter(c => c.visible);
    const headers = activeCols.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row => {
      return activeCols.map(col => {
        let val = '';
        if (col.id === 'item_code') val = row.item_code;
        else if (col.id === 'item_name') val = row.item_name;
        else if (col.id === 'item_group') val = row.item_group;
        else if (col.id === 'warehouse') val = row.warehouse;
        else if (col.id === 'stock_uom') val = row.stock_uom;
        else if (col.id === 'opening_qty') val = row.opening_qty;
        else if (col.id === 'opening_val') val = row.opening_val;
        else if (col.id === 'in_qty') val = row.in_qty;
        else if (col.id === 'in_val') val = row.in_val;
        else if (col.id === 'out_qty') val = row.out_qty;
        else if (col.id === 'out_val') val = row.out_val;
        else if (col.id === 'bal_qty') val = row.bal_qty;
        else if (col.id === 'val_rate') val = row.val_rate;
        else if (col.id === 'bal_val') val = row.bal_val;

        const stringVal = val !== null && val !== undefined ? String(val) : '';
        return `"${stringVal.replace(/"/g, '""')}"`;
      }).join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Balance_Report_${filters.from_date}_to_${filters.to_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report
  const printReport = () => {
    window.print();
  };

  return (
    <div className="erp-page sbr-container">

      {/* 1. Header */}
      <header className="sbr-header no-print">
        <div className="sbr-header-title-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="sbr-icon-badge">
              <Package size={22} className="stroke-[2.5]" />
            </div>
            <h1 className="sbr-title">STOCK BALANCE REPORT</h1>
            <span className="sbr-tag">Inventory Valuation</span>
          </div>
          <p className="sbr-subtitle">Real-time valuation, inventory levels, inward/outward logs and ledger balances</p>
        </div>

        <div className="sbr-actions">
          <button onClick={printReport} className="erp-button erp-button-secondary sbr-btn-secondary">
            <Printer size={15} />
            <span>Print</span>
          </button>
          <button onClick={exportCSV} className="erp-button erp-button-primary sbr-btn-primary">
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            className="sbr-btn-icon"
            onClick={() => setShowColConfig(true)}
            title="Configure Columns"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => fetchReport(filters)}
            disabled={loading}
            className="sbr-btn-icon"
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock Balance Report</h1>
            <p className="text-xs text-slate-600 mt-1">Real-time Inventory Valuation & Movement Breakdown</p>
          </div>
          <div className="text-right text-xs font-bold text-slate-700">
            <div><b>Period:</b> {filters.from_date} to {filters.to_date}</div>
            <div><b>Warehouse:</b> {filters.all_warehouses ? 'All Warehouses' : (filters.warehouse || 'All')}</div>
          </div>
        </div>
      </div>

      <main className="sbr-main-body">

        {/* 2. KPI Metrics Summary */}
        <div className="sbr-kpi-grid">
          <div className="sbr-kpi-card emerald">
            <div className="sbr-kpi-header">
              <div className="sbr-kpi-header-left">
                <div className="sbr-kpi-icon-pill">
                  <Boxes size={18} />
                </div>
                <span className="sbr-kpi-title">Closing Qty</span>
              </div>
            </div>
            <div>
              <div className="sbr-kpi-value">
                <span>{totalClosingQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
              </div>
              <div className="sbr-kpi-subtext">Total Units on Hand</div>
            </div>
          </div>

          <div className="sbr-kpi-card blue">
            <div className="sbr-kpi-header">
              <div className="sbr-kpi-header-left">
                <div className="sbr-kpi-icon-pill">
                  <DollarSign size={18} />
                </div>
                <span className="sbr-kpi-title">Closing Value</span>
              </div>
            </div>
            <div>
              <div className="sbr-kpi-value">
                <DirhamIcon size={18} />
                <span>{totalClosingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="sbr-kpi-subtext">Total Capital Investment</div>
            </div>
          </div>

          <div className="sbr-kpi-card purple">
            <div className="sbr-kpi-header">
              <div className="sbr-kpi-header-left">
                <div className="sbr-kpi-icon-pill">
                  <TrendingUp size={18} />
                </div>
                <span className="sbr-kpi-title">Inward Movement</span>
              </div>
            </div>
            <div>
              <div className="sbr-kpi-value">
                <span>{totalInQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Units</span>
              </div>
              <div className="sbr-kpi-subtext">
                Value: <DirhamIcon size={10} style={{ marginRight: '0.2rem' }} /> {totalInValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="sbr-kpi-card amber">
            <div className="sbr-kpi-header">
              <div className="sbr-kpi-header-left">
                <div className="sbr-kpi-icon-pill">
                  <TrendingDown size={18} />
                </div>
                <span className="sbr-kpi-title">Outward Movement</span>
              </div>
            </div>
            <div>
              <div className="sbr-kpi-value">
                <span>{totalOutQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Units</span>
              </div>
              <div className="sbr-kpi-subtext">
                Value: <DirhamIcon size={10} style={{ marginRight: '0.2rem' }} /> {totalOutValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Filters Card */}
        <div className="erp-filter-bar sbr-filter-card no-print">
          <div className="sbr-filter-inputs">
            {/* From Date */}
            <div className="sbr-field-block">
              <label className="sbr-label">
                <Calendar size={12} color="#2563eb" />
                From Date
              </label>
              <input
                type="date"
                className="sbr-input"
                value={filters.from_date}
                onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            {/* To Date */}
            <div className="sbr-field-block">
              <label className="sbr-label">
                <Calendar size={12} color="#2563eb" />
                To Date
              </label>
              <input
                type="date"
                className="sbr-input"
                value={filters.to_date}
                onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            {/* Filter by Product */}
            <div className="sbr-field-block" style={{ flex: '1.5 1 220px' }}>
              <label className="sbr-label">
                <Search size={12} color="#2563eb" />
                Filter by Product
              </label>
              <div style={{ position: 'relative' }}>
                <CustomSearchDropdown
                  placeholder="All Products (Search or type...)"
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
            <div className="sbr-field-block" style={{ flex: '1 1 180px' }}>
              <label className="sbr-label">
                <Layers size={12} />
                Item Group
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  className="sbr-select"
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
            <div className="sbr-field-block" style={{ flex: '1.2 1 200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="sbr-label">
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
                  className="sbr-select"
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
            className="sbr-btn-reset"
            onClick={() => {
              const reset = {
                from_date: getDate30DaysAgo(),
                to_date: getTodayDate(),
                warehouse: defaultUserWh,
                all_warehouses: isAdmin ? !defaultUserWh : false,
                item_code: '',
                item_group: ''
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

        {/* 4. Table viewport */}
        <div className="erp-table-scroll sbr-table-container">
          <div className="sbr-table-header-meta">
            <span className="sbr-meta-text">Found <b>{data.length}</b> stock record entries</span>
            {loading && (
              <span className="sbr-meta-text flex items-center gap-2" style={{ color: '#2563eb' }}>
                <Loader2 size={15} className="animate-spin" /> Calculating balances...
              </span>
            )}
          </div>

          <div className="erp-table-scroll sbr-table-wrapper">
            <table className="erp-table sbr-table">
              <thead>
                <tr>
                  {stockColumns.filter(c => c.visible).map(col => (
                    <th
                      key={col.id}
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        textAlign: ['opening_qty', 'opening_val', 'in_qty', 'in_val', 'out_qty', 'out_val', 'bal_qty', 'val_rate', 'bal_val'].includes(col.id) ? 'right' : 'left'
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
                    <td colSpan={stockColumns.filter(c => c.visible).length} style={{ textAlign: 'center', padding: '5rem 0', color: '#64748b' }}>
                      <Loader2 size={32} className="animate-spin mx-auto mb-2 text-blue-600" />
                      <p className="font-bold text-sm">Calculating inventory ledger balance...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={stockColumns.filter(c => c.visible).length} style={{ textAlign: 'center', padding: '5rem 0', color: '#64748b' }}>
                      <FileText size={42} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm text-slate-700">No stock entries found for selected criteria.</p>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const displayData = pageSize === -1 ? data : data.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                    return displayData.map((row, idx) => {
                      const openingQty = parseFloat(row.opening_qty) || 0;
                      const inQty = parseFloat(row.in_qty) || 0;
                      const outQty = parseFloat(row.out_qty) || 0;
                      const balQty = parseFloat(row.bal_qty) || 0;

                      return (
                        <tr key={idx}>
                          {stockColumns.filter(c => c.visible).map(col => {
                            switch (col.id) {
                              case 'item_code':
                                return (
                                  <td key={col.id}>
                                    <span onClick={() => navigate('/itemlist', { state: { search: row.item_code } })} className="sbr-code-capsule inline-flex items-center gap-1">
                                      {row.item_code}
                                      <ExternalLink size={11} className="opacity-70" />
                                    </span>
                                  </td>
                                );
                              case 'item_name':
                                return (
                                  <td key={col.id} style={{ fontWeight: 700, color: '#0f172a' }}>{row.item_name}</td>
                                );
                              case 'item_group':
                                return (
                                  <td key={col.id}><span className="sbr-badge-group">{row.item_group}</span></td>
                                );
                              case 'warehouse':
                                return (
                                  <td key={col.id} style={{ color: '#475569' }}>{row.warehouse}</td>
                                );
                              case 'stock_uom':
                                return (
                                  <td key={col.id}><span className="sbr-badge-uom">{row.stock_uom}</span></td>
                                );
                              case 'opening_qty':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    {openingQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                  </td>
                                );
                              case 'opening_val':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <DirhamIcon size={12} style={{ marginRight: '0.35rem' }} />
                                      {(parseFloat(row.opening_val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
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
                              case 'in_val':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <DirhamIcon size={12} style={{ marginRight: '0.35rem' }} />
                                      {(parseFloat(row.in_val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                );
                              case 'out_qty':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    {outQty > 0 ? (
                                      <span className="qty-pill-out">
                                        {outQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                      </span>
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>-</span>
                                    )}
                                  </td>
                                );
                              case 'out_val':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <DirhamIcon size={12} style={{ marginRight: '0.35rem' }} />
                                      {(parseFloat(row.out_val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                );
                              case 'bal_qty':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                    {balQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                  </td>
                                );
                              case 'val_rate':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', color: '#64748b' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <DirhamIcon size={12} style={{ marginRight: '0.35rem' }} />
                                      {(parseFloat(row.val_rate) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                );
                              case 'bal_val':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', fontWeight: 900, color: '#2563eb' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <DirhamIcon size={12} style={{ marginRight: '0.35rem' }} />
                                      {(parseFloat(row.bal_val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        config={stockColumns}
        onUpdate={handleColConfigUpdate}
        doctype="Stock Balance"
        themeColor={themeColor}
      />
    </div>
  );
}

export default StockBalanceReport;
