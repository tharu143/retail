import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Search, Filter, RefreshCw, 
    Download, Printer, ChevronDown, Package, Tag, ExternalLink, Settings,
    DollarSign, Receipt, ShoppingCart, Percent, TrendingUp, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import PrintConfigModal from './PrintConfigModal';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import './ItemwiseSalesReport.css';

function ItemWiseSalesReport() {
  const navigate = useNavigate();
  const { warehouse, user_roles, user } = useSelector(state => state.user || {});
  
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnConfig, setColumnConfig] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  
  // Print Customization State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOrientation, setPrintOrientation] = useState('portrait');
  const [selectedPrintColumns, setSelectedPrintColumns] = useState([]);

  useEffect(() => {
    if (columns.length > 0 && selectedPrintColumns.length === 0) {
      setSelectedPrintColumns(columns.map(c => c.fieldname));
    }
  }, [columns]);

  const [filters, setFilters] = useState({ 
    from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    customer: '', 
    item_code: '',
    pos_invoice: ''
  });
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  useEffect(() => {
    fetchCustomers();
    fetchItems();
    fetchReport(filters);
  }, [warehouse]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_PATH}.get_customers_list_rpt`, { 
        headers: { 'X-Frappe-SID': getSession() }, 
        credentials: 'include' 
      });
      const json = await res.json();
      setCustomers((json.message || json.data || json) || []);
    } catch (err) { console.error(err); }
  };

  const fetchItems = async () => {
    try {
      const params = new URLSearchParams();
      if (warehouse) params.append('warehouse', warehouse);
      const res = await fetch(`${API_PATH}.get_items?${params.toString()}`, { 
        headers: { 'X-Frappe-SID': getSession() }, 
        credentials: 'include' 
      });
      const json = await res.json();
      setItems((json.message || json.data || json) || []);
    } catch (err) { console.error(err); }
  };

  const fetchReport = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const params = new URLSearchParams(activeFilters);
      const res = await fetch(`${API_PATH}.get_item_wise_sales_report?${params.toString()}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const payload = result.message || result;

      if (payload.status === 'success') {
        const rawData = payload.data || [];
        setData(rawData);
        setHasGenerated(true);
        const fetchedCols = payload.columns || [];
        setColumns(fetchedCols);
        
        // Merge with local storage config
        const savedConfigStr = localStorage.getItem('itemwise_sales_report_columns');
        const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;
        
        let mergedCols = fetchedCols.map(c => ({
          id: c.fieldname,
          label: c.label,
          visible: true,
          width: (c.width ? c.width + 'px' : '150px'),
          align: c.align || (c.fieldtype === 'Currency' || c.fieldtype === 'Float' ? 'right' : 'left'),
          original: c
        }));
        
        if (savedConfig && Array.isArray(savedConfig)) {
          const configMap = {};
          savedConfig.forEach(sc => configMap[sc.id] = sc);
          
          mergedCols = mergedCols.map(mc => {
            if (configMap[mc.id]) {
              return { ...mc, visible: configMap[mc.id].visible !== undefined ? configMap[mc.id].visible : true, width: configMap[mc.id].width, align: configMap[mc.id].align };
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
        setSuccess(`Loaded ${payload.total_records || rawData.length || 0} records`);
      } else {
        setError(payload.message || 'Failed to generate report');
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
  };

  const handleColumnUpdate = (newConfig) => {
    if (!newConfig) {
      localStorage.removeItem('itemwise_sales_report_columns');
      const defaultCols = columns.map(c => ({
        id: c.fieldname,
        label: c.label,
        visible: true,
        width: (c.width ? c.width + 'px' : '150px'),
        align: c.align || (c.fieldtype === 'Currency' || c.fieldtype === 'Float' ? 'right' : 'left'),
        original: c
      }));
      setColumnConfig(defaultCols);
      return;
    }
    setColumnConfig(newConfig);
    localStorage.setItem('itemwise_sales_report_columns', JSON.stringify(newConfig));
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

  // Exclude backend Total row from KPI calculations
  const nonTotalRows = data.filter(r => !String(r.posting_date).includes('TOTAL'));

  const totalSalesRevenue = nonTotalRows.reduce((acc, row) => acc + (typeof row.total === 'number' ? row.total : 0), 0);
  const totalNetRevenue = nonTotalRows.reduce((acc, row) => acc + (typeof row.net_amount === 'number' ? row.net_amount : (row.amount || 0)), 0);
  const totalDiscounts = nonTotalRows.reduce((acc, row) => acc + (typeof row.discount_amount === 'number' ? row.discount_amount : 0), 0);
  const totalTaxAmount = nonTotalRows.reduce((acc, row) => acc + (typeof row.tax_amount === 'number' ? row.tax_amount : 0), 0);
  const totalQtySold = nonTotalRows.reduce((acc, row) => acc + (typeof row.qty === 'number' ? row.qty : 0), 0);
  const uniqueItemsCount = new Set(nonTotalRows.map(r => r.item_code)).size;

  const handleExportCSV = () => {
    if (!data.length) return;
    const visibleCols = columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id));
    const headers = visibleCols.map(c => `"${c.label}"`).join(',');
    const rows = data.map(row => {
      return visibleCols.map(c => {
        const val = row[c.original.fieldname];
        const cleanVal = typeof val === 'string' ? val.replace(/<[^>]*>?/gm, '') : val;
        return `"${cleanVal !== undefined && cleanVal !== null ? String(cleanVal).replace(/"/g, '""') : ''}"`;
      }).join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ItemWise_Sales_Report_${filters.from_date}_to_${filters.to_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="iws-container">
      
      {/* 1. Header */}
      <header className="iws-header no-print">
        <div className="iws-header-title-box">
          <div className="iws-icon-badge">
            <Package size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="iws-title">Item-Wise Sales Report</h1>
              <span className="iws-tag">Products & Profitability</span>
            </div>
            <p className="iws-subtitle">Granular item-level sales volume, tax breakdown, and discounts</p>
          </div>
        </div>

        <div className="iws-actions">
          <button 
            onClick={handlePrint}
            className="iws-btn-secondary"
          >
            <Printer size={15} /> 
            <span>Print Report</span>
          </button>
          <button 
            onClick={handleExportCSV}
            className="iws-btn-primary"
          >
            <Download size={15} /> 
            <span>Export CSV</span>
          </button>
          <button 
            className="iws-btn-icon" 
            onClick={() => setShowConfigModal(true)}
            title="Configure Columns"
          >
            <Settings size={18} />
          </button>
          <button 
            onClick={() => fetchReport(filters)}
            disabled={loading}
            className="iws-btn-icon"
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Item-Wise Sales Report</h1>
            <p className="text-xs text-slate-600 mt-1">Granular Product Sales & Margin Audit</p>
          </div>
          <div className="text-right text-xs font-bold text-slate-700">
            <div><b>Period:</b> {filters.from_date || 'Start'} to {filters.to_date || 'End'}</div>
            <div><b>Customer:</b> {filters.customer || 'All Customers'}</div>
            <div><b>Branch:</b> {warehouse || 'All Warehouses'}</div>
          </div>
        </div>
      </div>

      <main className="iws-main-body">
        
        {/* 2. Filters Bar */}
        <div className="iws-filter-card no-print">
          <div className="iws-filter-inputs">
            {/* From Date */}
            <div className="iws-field-block">
              <label className="iws-label">
                <Calendar size={12} color="#059669" />
                From Date
              </label>
              <input 
                type="date" 
                className="iws-input" 
                value={filters.from_date}
                onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
              />
            </div>
            
            {/* To Date */}
            <div className="iws-field-block">
              <label className="iws-label">
                <Calendar size={12} color="#059669" />
                To Date
              </label>
              <input 
                type="date" 
                className="iws-input" 
                value={filters.to_date}
                onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
              />
            </div>

            {/* Customer */}
            <div className="iws-field-block" style={{ flex: '1.2 1 200px' }}>
              <label className="iws-label">
                <Search size={12} />
                Customer
              </label>
              <div style={{ position: 'relative' }}>
                <select 
                  className="iws-select" 
                  value={filters.customer}
                  onChange={(e) => handleFilterUpdate('customer', e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                >
                  <option value="">All Customers</option>
                  {customers.map(c => <option key={c.name} value={c.name}>{c.customer_name || c.name}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>

            {/* Product / Item */}
            <div className="iws-field-block" style={{ flex: '1.4 1 220px' }}>
              <label className="iws-label">
                <Package size={12} />
                Product / Item
              </label>
              <div style={{ position: 'relative' }}>
                <select 
                  className="iws-select" 
                  value={filters.item_code}
                  onChange={(e) => handleFilterUpdate('item_code', e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                >
                  <option value="">All Products</option>
                  {items.map(i => <option key={i.item_code} value={i.item_code}>{i.item_name || i.item_code}</option>)}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>

            {/* POS Invoice Ref */}
            <div className="iws-field-block" style={{ flex: '1 1 160px' }}>
              <label className="iws-label">
                <Tag size={12} />
                Invoice Ref #
              </label>
              <input 
                type="text" 
                className="iws-input" 
                placeholder="ACC-SINV-..."
                value={filters.pos_invoice}
                onChange={(e) => handleFilterUpdate('pos_invoice', e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
            <button 
              className="iws-btn-reset"
              onClick={() => {
                const reset = { from_date: '', to_date: '', customer: '', item_code: '', pos_invoice: '' };
                setFilters(reset);
                fetchReport(reset);
              }}
            >
              Reset
            </button>
            <button 
              className="iws-btn-primary"
              onClick={() => fetchReport(filters)}
              disabled={loading}
              style={{ height: '42px' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Generate</span>
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{ padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 'bold' }}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* 3. KPI Metrics Summary Cards */}
        <div className="iws-kpi-grid">
          {/* Total Revenue */}
          <div className="iws-kpi-card emerald">
            <div className="iws-kpi-header">
              <span className="iws-kpi-title">Gross Item Sales</span>
              <div className="iws-kpi-icon-pill">
                <Receipt size={16} />
              </div>
            </div>
            <div>
              <div className="iws-kpi-value">
                <DirhamIcon size={18} />
                <span>{totalSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="iws-kpi-subtext">
                Net: AED {totalNetRevenue.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Units Sold */}
          <div className="iws-kpi-card blue">
            <div className="iws-kpi-header">
              <span className="iws-kpi-title">Units Sold</span>
              <div className="iws-kpi-icon-pill">
                <ShoppingCart size={16} />
              </div>
            </div>
            <div>
              <div className="iws-kpi-value">
                <span>{totalQtySold.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Qty</span>
              </div>
              <div className="iws-kpi-subtext" style={{ color: '#2563eb' }}>
                {uniqueItemsCount} Unique Products Sold
              </div>
            </div>
          </div>

          {/* Discounts Given */}
          <div className="iws-kpi-card pink">
            <div className="iws-kpi-header">
              <span className="iws-kpi-title">Item Discounts</span>
              <div className="iws-kpi-icon-pill">
                <Percent size={16} />
              </div>
            </div>
            <div>
              <div className="iws-kpi-value">
                <DirhamIcon size={18} />
                <span>{totalDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="iws-kpi-subtext" style={{ color: '#db2777' }}>
                Discounts & Promotions
              </div>
            </div>
          </div>

          {/* Tax / VAT */}
          <div className="iws-kpi-card amber">
            <div className="iws-kpi-header">
              <span className="iws-kpi-title">Output VAT / Tax</span>
              <div className="iws-kpi-icon-pill">
                <Tag size={16} />
              </div>
            </div>
            <div>
              <div className="iws-kpi-value">
                <DirhamIcon size={18} />
                <span>{totalTaxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="iws-kpi-subtext" style={{ color: '#d97706' }}>
                Sales VAT Collected
              </div>
            </div>
          </div>
        </div>

        {/* 4. Table Card */}
        <div className="iws-table-card">
          <div className="iws-table-header">
            <h3 className="iws-table-heading">
              <FileText size={18} color="#10b981" />
              <span>Granular Item Sales Table</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
              <span>Showing <b>{nonTotalRows.length}</b> line items</span>
              {loading && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                  <RefreshCw size={14} className="animate-spin" /> Fetching...
                </span>
              )}
            </div>
          </div>

          <div className="iws-table-wrapper">
            <table className="iws-table">
              <thead>
                <tr>
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
                    <td colSpan={columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).length || 1} style={{ padding: '5rem 0', textAlign: 'center' }}>
                      <Loader2 size={32} color="#10b981" className="animate-spin" style={{ margin: '0 auto' }} />
                      <p style={{ marginTop: '0.75rem', fontWeight: 800, color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Building Item Matrix...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).length || 1} style={{ padding: '5rem 0', textAlign: 'center' }}>
                      <div style={{ opacity: 0.2, marginBottom: '0.75rem' }}>
                        <Package size={44} style={{ margin: '0 auto' }} />
                      </div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>
                        {hasGenerated ? "No inventory sales records found for selected filters." : "Click 'Generate' to query records."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  data.map((row, idx) => {
                    const isTotalRow = String(row.posting_date).includes('TOTAL');
                    return (
                      <tr 
                        key={idx}
                        style={{
                          backgroundColor: isTotalRow ? '#f8fafc' : 'transparent',
                          fontWeight: isTotalRow ? 900 : 600
                        }}
                      >
                        {columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).map((col) => {
                          const fieldname = col.original.fieldname;
                          const cellValue = row[fieldname];
                          return (
                            <td 
                              key={col.id} 
                              style={{ 
                                textAlign: col.align,
                                fontFamily: col.original.fieldtype === 'Currency' || col.original.fieldtype === 'Float' ? 'ui-monospace, monospace' : 'inherit',
                                width: col.width,
                                minWidth: col.width,
                                maxWidth: col.width,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: isTotalRow && fieldname === 'total' ? '#059669' : (isTotalRow ? '#0f172a' : '#334155'),
                                fontSize: isTotalRow ? '0.85rem' : '0.8rem'
                              }}
                              title={String(cellValue ?? '')}
                            >
                              {cellValue !== null && cellValue !== undefined ? (
                                (fieldname === 'name' || fieldname === 'voucher_no' || fieldname === 'parent' || fieldname === 'pos_invoice') && !isTotalRow ? (
                                  <span 
                                    onClick={() => navigate('/salesinvoicelist', { state: { search: cellValue } })} 
                                    className="iws-doc-link"
                                    style={{ justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}
                                  >
                                    {String(cellValue).replace(' - KSPL', '')}
                                    <ExternalLink size={12} color="#10b981" />
                                  </span>
                                ) : fieldname === 'item_code' && !isTotalRow ? (
                                  <span 
                                    onClick={() => navigate('/itemlist', { state: { search: cellValue } })} 
                                    className="iws-item-pill"
                                    style={{ marginLeft: col.align === 'right' ? 'auto' : '0' }}
                                  >
                                    {String(cellValue).replace(' - KSPL', '')}
                                    <ExternalLink size={11} color="#64748b" />
                                  </span>
                                ) : typeof cellValue === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('rate') || col.label?.toLowerCase().includes('amount')) ? 
                                  cellValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 
                                  typeof cellValue === 'string' && cellValue.startsWith('<b>') ?
                                  <span dangerouslySetInnerHTML={{ __html: cellValue }} /> :
                                  String(cellValue).replace(' - KSPL', '')
                              ) : '-'}
                            </td>
                          );
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

      {/* Print Configuration Modal */}
      <PrintConfigModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        columns={columns}
        selectedColumns={selectedPrintColumns}
        onSelectedColumnsChange={setSelectedPrintColumns}
        orientation={printOrientation}
        onOrientationChange={setPrintOrientation}
        onPrint={executePrint}
        themeColor="#10b981"
      />
      
      {/* Column Config Modal */}
      <ColumnConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={columnConfig}
        onUpdate={handleColumnUpdate}
        doctype="Item-Wise Sales Report"
        themeColor="#10b981"
      />
    </div>
  );
}

export default ItemWiseSalesReport;