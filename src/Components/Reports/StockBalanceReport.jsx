import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    Loader2, FileText, AlertCircle, Calendar, Search, 
    Filter, Palette, RefreshCw, Download, Printer, 
    ChevronDown, Boxes, Layers, Package, TrendingUp, TrendingDown, DollarSign,
    Settings, ExternalLink
} from 'lucide-react';
import { db } from '../../db';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import './StockBalanceReport.css';

const DEFAULT_STOCK_COLUMNS = [
  { id: 'item_code', label: 'Item Code', visible: true, width: 140 },
  { id: 'item_name', label: 'Item Name', visible: true, width: 180 },
  { id: 'item_group', label: 'Item Group', visible: true, width: 120 },
  { id: 'warehouse', label: 'Warehouse', visible: true, width: 160 },
  { id: 'stock_uom', label: 'UOM', visible: true, width: 90 },
  { id: 'opening_qty', label: 'Opening Qty', visible: true, width: 110 },
  { id: 'opening_val', label: 'Opening Value', visible: true, width: 130 },
  { id: 'in_qty', label: 'In Qty', visible: true, width: 110 },
  { id: 'in_val', label: 'In Value', visible: true, width: 130 },
  { id: 'out_qty', label: 'Out Qty', visible: true, width: 110 },
  { id: 'out_val', label: 'Out Value', visible: true, width: 130 },
  { id: 'bal_qty', label: 'Closing Qty', visible: true, width: 110 },
  { id: 'val_rate', label: 'Valuation Rate', visible: true, width: 120 },
  { id: 'bal_val', label: 'Closing Value', visible: true, width: 140 }
];

function StockBalanceReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    <div className="so-page stock-balance-report-container">
      
      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <Boxes size={22} />
            Stock Balance Report
          </h1>
          <p className="so-page-subtitle">Real-time valuation, inventory levels, inward/outward logs and ledger balances</p>
        </div>
        
        <div className="header-actions">
          <button onClick={toggleTheme} className="theme-toggle-btn" style={{ borderColor: themeColor, color: themeColor }}>
            <Palette size={14} /> {isGreen ? 'BLUE THEME' : 'GREEN THEME'}
          </button>
          <div className="action-divider"></div>
          <button className="so-btn-secondary" onClick={() => setShowColConfig(true)}>
             <Settings size={16} /> Customize Columns
          </button>
          <button className="so-btn-secondary" onClick={printReport}>
             <Printer size={16} /> Print
          </button>
          <button className="so-btn-primary" onClick={exportCSV} style={{ background: themeColor, borderColor: themeColor }}>
             <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="so-layout">
        
        {/* 2. SUMMARY METRIC CARDS */}
        <div className="metrics-grid">
          <div className="metric-card balance">
            <div className="metric-icon-box" style={{ background: themeColor + '15', color: themeColor }}>
              <Boxes size={22} />
            </div>
            <div className="metric-info">
              <h3>Closing Qty</h3>
              <p className="metric-value">{totalClosingQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}</p>
              <span className="metric-sub">Total Units on Hand</span>
            </div>
          </div>

          <div className="metric-card value">
            <div className="metric-icon-box" style={{ background: '#10b98115', color: '#10b981' }}>
              <DollarSign size={22} />
            </div>
            <div className="metric-info">
              <h3 className="flex items-center gap-1">Closing Value (<DirhamIcon size={12} />)</h3>
              <p className="metric-value flex items-center justify-center gap-1.5"><DirhamIcon size={22} /> {totalClosingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <span className="metric-sub">Total Capital Investment</span>
            </div>
          </div>

          <div className="metric-card inbound">
            <div className="metric-icon-box" style={{ background: '#3b82f615', color: '#3b82f6' }}>
              <TrendingUp size={22} />
            </div>
            <div className="metric-info">
              <h3>Inward Movement</h3>
              <p className="metric-value">{totalInQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} Units</p>
               <span className="metric-sub flex items-center justify-center gap-1">Value: <DirhamIcon size={9} /> {totalInValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="metric-card outbound">
            <div className="metric-icon-box" style={{ background: '#f59e0b15', color: '#f59e0b' }}>
              <TrendingDown size={22} />
            </div>
            <div className="metric-info">
              <h3>Outward Movement</h3>
              <p className="metric-value">{totalOutQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} Units</p>
               <span className="metric-sub flex items-center justify-center gap-1">Value: <DirhamIcon size={9} /> {totalOutValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* 3. DYNAMIC HORIZONTAL FILTERS */}
        <div className="so-filter-bar filters-wrapper">
          <div className="filter-input-field flex-2">
            <label className="so-filter-label">From Date</label>
            <div className="so-relative">
               <Calendar size={14} className="input-icon" style={{ color: themeColor }} />
               <input 
                 type="date" 
                 className="so-filter-input" 
                 value={filters.from_date}
                 onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
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
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>

          <div className="filter-input-field flex-3">
            <label className="so-filter-label">Filter by Product</label>
            <div className="so-relative dropdown-search-container">
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

        {/* 4. CONTENT VIEWPORT */}
        <main className="so-content stock-table-viewport">
          {error && (
            <div className="report-error-banner">
               <AlertCircle size={18} /> {error}
            </div>
          )}

          <div className="results-header">
            <p className="so-list-meta">Found <b>{data.length}</b> rows matching criteria</p>
            {loading && (
              <div className="loading-indicator" style={{ color: themeColor }}>
                <Loader2 size={16} className="animate-spin" /> RUNNING STOCK CALCULATION...
              </div>
            )}
          </div>

          <div className="so-table-card table-outer-box">
            <div className="so-table-wrapper scrollable-table-area">
              <table className="so-table premium-stock-table">
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
                      <td colSpan={stockColumns.filter(c => c.visible).length} className="so-empty" style={{ padding: '6rem 0' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                        <p className="loading-text">Rebuilding Stock Ledger...</p>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={stockColumns.filter(c => c.visible).length} className="so-empty" style={{ padding: '6rem 0' }}>
                        <div className="empty-state-icon">
                           <FileText size={48} />
                        </div>
                        <p className="empty-state-text">No inventory ledger transactions match the filters.</p>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => {
                      const openingQty = parseFloat(row.opening_qty) || 0;
                      const inQty = parseFloat(row.in_qty) || 0;
                      const outQty = parseFloat(row.out_qty) || 0;
                      const balQty = parseFloat(row.bal_qty) || 0;

                      return (
                        <tr key={idx} className="table-row-hover">
                          {stockColumns.filter(c => c.visible).map(col => {
                            switch (col.id) {
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
                              case 'item_group':
                                return (
                                  <td key={col.id}><span className="badge-item-group">{row.item_group}</span></td>
                                );
                              case 'warehouse':
                                return (
                                  <td key={col.id} className="warehouse-cell">
                                    <span className="warehouse-name">{row.warehouse?.replace(' - KSPL', '')}</span>
                                    <span className="warehouse-sub">KSPL</span>
                                  </td>
                                );
                              case 'stock_uom':
                                return (
                                  <td key={col.id}><span className="badge-uom">{row.stock_uom}</span></td>
                                );
                              case 'opening_qty':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', fontWeight: 600 }}>
                                    {openingQty === 0 ? <span className="text-muted-zero">0</span> : openingQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                  </td>
                                );
                              case 'opening_val':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} className="text-slate-400" /> {(parseFloat(row.opening_val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                              case 'in_val':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} className="text-slate-400" /> {(parseFloat(row.in_val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </td>
                                );
                              case 'out_qty':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    {outQty > 0 ? (
                                      <span className="qty-badge-pill outgoing">
                                        -{outQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                      </span>
                                    ) : (
                                      <span className="text-muted-zero">-</span>
                                    )}
                                  </td>
                                );
                              case 'out_val':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right' }}>
                                    <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} className="text-slate-400" /> {(parseFloat(row.out_val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </td>
                                );
                              case 'bal_qty':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                                    {balQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                  </td>
                                );
                              case 'val_rate':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', color: '#64748b' }}>
                                    <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} className="text-slate-400" /> {(parseFloat(row.val_rate) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </td>
                                );
                              case 'bal_val':
                                return (
                                  <td key={col.id} style={{ textAlign: 'right', fontWeight: 800, color: themeColor }}>
                                    <span className="flex items-center justify-end gap-1"><DirhamIcon size={12} style={{ color: themeColor }} /> {(parseFloat(row.bal_val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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

      {/* Column Customization Modal */}
      <ColumnConfigModal
        isOpen={showColConfig}
        onClose={() => setShowColConfig(false)}
        config={stockColumns}
        onUpdate={handleColConfigUpdate}
        doctype="Stock Balance"
        themeColor={themeColor}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .stock-balance-report-container {
          --primary-color: ${themeColor};
          --primary-color-hover: ${themeColorHover};
          --primary-light: ${themeLight};
        }
      `}} />
    </div>
  );
}

export default StockBalanceReport;
