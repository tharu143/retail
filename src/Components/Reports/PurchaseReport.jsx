import React, { useState, useEffect } from 'react';
import {
  Loader2, FileText, AlertCircle, CheckCircle2,
  Calendar, Search, Filter, RefreshCw,
  Download, Printer, ChevronDown, Truck, Package, ExternalLink, Settings,
  DollarSign, Receipt, Tag, TrendingUp, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import './PurchaseReport.css';

function PurchaseReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnConfig, setColumnConfig] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState({
    from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    supplier: '',
    item_code: ''
  });
  const [suppliers, setSuppliers] = useState([]);

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  useEffect(() => {
    fetchSuppliers();
    fetchReport(filters);
  }, []);

  const getDefaultColWidth = (fieldname, colWidth) => {
    if (colWidth && parseInt(colWidth) >= 150) {
      return typeof colWidth === 'number' ? colWidth + 'px' : colWidth;
    }
    switch (fieldname) {
      case 'posting_date': case 'date': return '130px';
      case 'name': case 'voucher_no': case 'purchase_invoice': return '190px';
      case 'supplier': return '160px';
      case 'supplier_name': return '200px';
      case 'item_code': return '145px';
      case 'item_name': return '220px';
      case 'qty': return '90px';
      case 'rate': return '110px';
      case 'amount': return '125px';
      case 'tax_amount': return '120px';
      case 'total': return '135px';
      case 'warehouse': return '160px';
      default: return (colWidth ? (typeof colWidth === 'number' ? colWidth + 'px' : colWidth) : '150px');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_PATH}.get_suppliers_pi`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSuppliers((json.message || json.data || json) || []);
    } catch (err) {
      console.error('Suppliers fetch error:', err);
    }
  };

  const fetchReport = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const params = new URLSearchParams(activeFilters);
      const res = await fetch(`${API_PATH}.get_purchase_report?${params.toString()}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const payload = result.message || result;

      if (payload.status === 'success') {
        setData(payload.data || []);
        const fetchedCols = payload.columns || [];
        setColumns(fetchedCols);

        // Merge with local storage config
        const savedConfigStr = localStorage.getItem('purchase_report_columns');
        const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;

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
        setSuccess('Purchase records loaded');
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
    fetchReport(next);
  };

  const handleColumnUpdate = (newConfig) => {
    if (!newConfig) {
      localStorage.removeItem('purchase_report_columns');
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
    localStorage.setItem('purchase_report_columns', JSON.stringify(newConfig));
  };

  // Compute Summary KPI Stats
  const totalSpend = data.reduce((acc, row) => acc + (row.total || row.amount || 0), 0);
  const totalTax = data.reduce((acc, row) => acc + (row.tax_amount || 0), 0);
  const totalNet = data.reduce((acc, row) => acc + (row.amount || 0), 0);
  const totalQty = data.reduce((acc, row) => acc + (row.qty || 0), 0);
  const uniqueInvoices = new Set(data.map(d => d.name)).size;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!data.length) return;
    const visibleCols = columnConfig.filter(c => c.visible);
    const headers = visibleCols.map(c => `"${c.label}"`).join(',');
    const rows = data.map(row => {
      return visibleCols.map(c => {
        const val = row[c.original.fieldname];
        return `"${val !== undefined && val !== null ? String(val).replace(/"/g, '""') : ''}"`;
      }).join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchase_Report_${filters.from_date}_to_${filters.to_date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="erp-page pr-container">

      {/* 1. Header */}
      <header className="pr-header no-print">
        <div className="pr-header-title-box" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="pr-icon-badge">
              <Truck size={22} className="stroke-[2.5]" />
            </div>
            <h1 className="pr-title">PURCHASE SUMMARY REPORT</h1>
            <span className="pr-tag">Procurement</span>
          </div>
          <p className="pr-subtitle" style={{ margin: '2px 0 0 0' }}>Historical breakdown of stock procurement and vendor payouts</p>
        </div>

        <div className="pr-actions">
          <button
            onClick={handlePrint}
            className="erp-button erp-button-secondary pr-btn-secondary"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="erp-button erp-button-primary pr-btn-primary"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
          <button
            className="pr-btn-icon"
            onClick={() => setShowConfigModal(true)}
            title="Configure Columns"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => fetchReport(filters)}
            disabled={loading}
            className="pr-btn-icon"
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Summary Report</h1>
            <p className="text-xs text-slate-600 mt-1">Vendor Stock Procurement & Tax Breakdown</p>
          </div>
          <div className="text-right text-xs font-bold text-slate-700">
            <div><b>Period:</b> {filters.from_date || 'Start'} to {filters.to_date || 'End'}</div>
            <div><b>Vendor:</b> {filters.supplier || 'All Suppliers'}</div>
          </div>
        </div>
      </div>

      <main className="pr-main-body">

        {/* 2. Filters Bar */}
        <div className="erp-filter-bar pr-filter-card no-print">
          <div className="pr-filter-inputs">
            {/* From Date */}
            <div className="pr-field-block">
              <label className="pr-label">
                <Calendar size={12} color="#2563eb" />
                From Date
              </label>
              <input
                type="date"
                className="pr-input"
                value={filters.from_date}
                onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            {/* To Date */}
            <div className="pr-field-block">
              <label className="pr-label">
                <Calendar size={12} color="#2563eb" />
                To Date
              </label>
              <input
                type="date"
                className="pr-input"
                value={filters.to_date}
                onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
              />
            </div>

            {/* Vendor / Supplier */}
            <div className="pr-field-block" style={{ flex: '1.5 1 260px' }}>
              <label className="pr-label">
                <Search size={12} />
                Vendor / Supplier
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  className="pr-select"
                  value={filters.supplier}
                  onChange={(e) => handleFilterUpdate('supplier', e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map(s => (
                    <option key={s.name} value={s.name}>{s.supplier_name || s.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>
          </div>

          <button
            className="pr-btn-reset"
            onClick={() => {
              const reset = { from_date: '', to_date: '', supplier: '', item_code: '' };
              setFilters(reset);
              fetchReport(reset);
            }}
          >
            Reset Filters
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{ padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 'bold' }}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* 3. KPI Metrics Summary */}
        <div className="pr-kpi-grid">
          <div className="pr-kpi-card emerald">
            <div className="pr-kpi-header">
              <div className="pr-kpi-header-left">
                <div className="pr-kpi-icon-pill">
                  <Receipt size={18} />
                </div>
                <span className="pr-kpi-title">Total Procurement Spend</span>
              </div>
            </div>
            <div>
              <div className="pr-kpi-value">
                <DirhamIcon size={18} />
                <span>{totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="pr-kpi-subtext">
                Net: AED {totalNet.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="pr-kpi-card blue">
            <div className="pr-kpi-header">
              <div className="pr-kpi-header-left">
                <div className="pr-kpi-icon-pill">
                  <FileText size={18} />
                </div>
                <span className="pr-kpi-title">Total Invoices & Lines</span>
              </div>
            </div>
            <div>
              <div className="pr-kpi-value">
                <span>{uniqueInvoices}</span>
                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>inv / {data.length} items</span>
              </div>
              <div className="pr-kpi-subtext">
                Purchase Invoices
              </div>
            </div>
          </div>

          <div className="pr-kpi-card purple">
            <div className="pr-kpi-header">
              <div className="pr-kpi-header-left">
                <div className="pr-kpi-icon-pill">
                  <Package size={18} />
                </div>
                <span className="pr-kpi-title">Total Units Purchased</span>
              </div>
            </div>
            <div>
              <div className="pr-kpi-value">
                <span>{totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Qty</span>
              </div>
              <div className="pr-kpi-subtext">
                Total Stock Quantity
              </div>
            </div>
          </div>

          <div className="pr-kpi-card amber">
            <div className="pr-kpi-header">
              <div className="pr-kpi-header-left">
                <div className="pr-kpi-icon-pill">
                  <Tag size={18} />
                </div>
                <span className="pr-kpi-title">Total Input VAT / Tax</span>
              </div>
            </div>
            <div>
              <div className="pr-kpi-value">
                <DirhamIcon size={18} />
                <span>{totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="pr-kpi-subtext">
                Input Tax Recoverable
              </div>
            </div>
          </div>
        </div>

        {/* 4. Table Card */}
        <div className="erp-table-card pr-table-card">
          <div className="pr-table-header">
            <h3 className="pr-table-heading">
              <FileText size={18} color="#2563eb" />
              <span>Purchase Invoices & Items Log</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
              <span>Computed <b>{data.length}</b> line entries</span>
              {loading && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#2563eb' }}>
                  <RefreshCw size={14} className="animate-spin" /> Fetching...
                </span>
              )}
            </div>
          </div>

          <div className="erp-table-scroll pr-table-wrapper">
            <table className="erp-table pr-table">
              <thead>
                <tr>
                  {columnConfig.filter(c => c.visible).map((col) => (
                    <th key={col.id} style={{ width: col.width, minWidth: col.width, textAlign: col.align }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={columnConfig.filter(c => c.visible).length || 1} style={{ padding: '5rem 0', textAlign: 'center' }}>
                      <Loader2 size={32} color="#2563eb" className="animate-spin" style={{ margin: '0 auto' }} />
                      <p style={{ marginTop: '0.75rem', fontWeight: 800, color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analyzing Inbound Orders...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={columnConfig.filter(c => c.visible).length || 1} style={{ padding: '5rem 0', textAlign: 'center' }}>
                      <div style={{ opacity: 0.2, marginBottom: '0.75rem' }}>
                        <Package size={44} style={{ margin: '0 auto' }} />
                      </div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8' }}>No procurement records found for the selected vendor/period.</p>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const displayData = pageSize === -1 ? data : data.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                    return displayData.map((row, idx) => (
                      <tr key={idx}>
                        {columnConfig.filter(c => c.visible).map((col) => {
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
                                padding: '0.85rem 1rem',
                                whiteSpace: 'nowrap'
                              }}
                              title={String(cellValue ?? '')}
                            >
                              {cellValue !== null && cellValue !== undefined ? (
                                (fieldname === 'name' || fieldname === 'voucher_no') ? (
                                  <span
                                    onClick={() => navigate('/purchaseinvoicelist', { state: { search: cellValue } })}
                                    className="pr-doc-link"
                                    style={{ justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}
                                  >
                                    {cellValue}
                                    <ExternalLink size={12} color="#2563eb" />
                                  </span>
                                ) : fieldname === 'item_code' ? (
                                  <span
                                    onClick={() => navigate('/itemlist', { state: { search: cellValue } })}
                                    className="pr-item-pill"
                                    style={{ marginLeft: col.align === 'right' ? 'auto' : '0' }}
                                  >
                                    {cellValue}
                                    <ExternalLink size={11} color="#64748b" />
                                  </span>
                                ) : typeof cellValue === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('rate') || col.label?.toLowerCase().includes('amount')) ?
                                  cellValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                                  cellValue
                              ) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ));
                  })()
                )}
              </tbody>
              {data.length > 0 && (
                <tfoot>
                  <tr>
                    {columnConfig.filter(c => c.visible).map((col, cIdx) => {
                      const fname = col.original.fieldname;
                      if (cIdx === 0) {
                        return <td key={col.id} style={{ textAlign: col.align }}>TOTAL</td>;
                      }
                      if (fname === 'qty') {
                        return <td key={col.id} style={{ textAlign: col.align, fontFamily: 'monospace' }}>{totalQty.toFixed(2)}</td>;
                      }
                      if (fname === 'amount') {
                        return <td key={col.id} style={{ textAlign: col.align, fontFamily: 'monospace' }}>AED {totalNet.toFixed(2)}</td>;
                      }
                      if (fname === 'tax_amount') {
                        return <td key={col.id} style={{ textAlign: col.align, fontFamily: 'monospace' }}>AED {totalTax.toFixed(2)}</td>;
                      }
                      if (fname === 'total') {
                        return <td key={col.id} style={{ textAlign: col.align, fontFamily: 'monospace', color: '#059669', fontSize: '0.95rem' }}>AED {totalSpend.toFixed(2)}</td>;
                      }
                      return <td key={col.id}></td>;
                    })}
                  </tr>
                </tfoot>
              )}
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

      {/* Column Config Modal */}
      <ColumnConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={columnConfig}
        onUpdate={handleColumnUpdate}
        doctype="Purchase Report"
        themeColor="#10b981"
      />
    </div>
  );
}

export default PurchaseReport;