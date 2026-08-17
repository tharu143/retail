import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    Loader2, FileText, AlertCircle, Calendar, 
    RefreshCw, Download, Printer, 
    ChevronDown, DollarSign, TrendingUp, TrendingDown, ClipboardList, ChevronLeft, ExternalLink, Settings
} from 'lucide-react';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { authFetchBase } from '../../utils/authFetch';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';
import './GeneralLedgerReport.css';

// Map voucher types to ERPNext URL slugs
const getVoucherUrl = (voucherType, voucherNo) => {
  if (!voucherType || !voucherNo) return null;
  const no = encodeURIComponent(voucherNo);
  switch (voucherType) {
    case 'Sales Invoice': return `/salesinvoice?invoice=${no}`;
    case 'Purchase Invoice': return `/purchaseinvoicelist?name=${no}`;
    case 'Purchase Receipt': return `/purchasereceiptlist?name=${no}`;
    case 'Delivery Note': return `/deliverynote-details/${no}`;
    case 'Sales Order': return `/salesorder-details/${no}`;
    default: return null;
  }
};

const DEFAULT_GL_COLUMNS = [
  { id: 'posting_date', label: 'Posting Date', visible: true, width: '120px' },
  { id: 'voucher_type', label: 'Voucher Type', visible: true, width: '140px' },
  { id: 'voucher_no', label: 'Voucher No', visible: true, width: '160px' },
  { id: 'against', label: 'Against Account', visible: true, width: '180px' },
  { id: 'debit', label: 'Debit', visible: true, width: '120px' },
  { id: 'credit', label: 'Credit', visible: true, width: '120px' },
  { id: 'balance', label: 'Balance', visible: true, width: '130px' },
  { id: 'remarks', label: 'Remarks', visible: true, width: '220px' }
];

function GeneralLedgerReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [columnConfig, setColumnConfig] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Date helpers
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getDate30DaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  };

  // ----- URL Query & Filter Initialization -----
  const getInitialFilters = () => {
    const from_date = searchParams.get('from_date') || getDate30DaysAgo();
    const to_date = searchParams.get('to_date') || getTodayDate();
    const party_type = searchParams.get('party_type') || 'Customer';
    const party = searchParams.get('party') || '';

    return {
      from_date,
      to_date,
      party_type,
      party
    };
  };

  const [filters, setFilters] = useState(getInitialFilters());
  const [selectedPartyObj, setSelectedPartyObj] = useState(null);

  // Sync parameters from URL on load/change
  useEffect(() => {
    const initialFilters = getInitialFilters();
    setFilters(initialFilters);
    if (initialFilters.party) {
      setSelectedPartyObj({ 
        name: initialFilters.party, 
        label: initialFilters.party,
        customer_name: initialFilters.party,
        supplier_name: initialFilters.party 
      });
    } else {
      setSelectedPartyObj(null);
    }
    fetchReport(initialFilters);

    // Column Config initialization - normalizes visible & show fields
    const savedConfigStr = localStorage.getItem('general_ledger_columns');
    const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;
    
    let defaultCols = DEFAULT_GL_COLUMNS.map(c => ({
      id: c.id,
      label: c.label,
      visible: true,
      width: c.width,
      align: ['debit', 'credit', 'balance'].includes(c.id) ? 'right' : 'left',
      original: c
    }));

    if (savedConfig && Array.isArray(savedConfig)) {
      const configMap = {};
      savedConfig.forEach(sc => configMap[sc.id] = sc);
      defaultCols = defaultCols.map(mc => {
        if (configMap[mc.id]) {
          const isVis = configMap[mc.id].visible !== undefined ? configMap[mc.id].visible : (configMap[mc.id].show !== undefined ? configMap[mc.id].show : true);
          return { 
            ...mc, 
            visible: isVis,
            width: configMap[mc.id].width || mc.width, 
            align: configMap[mc.id].align || mc.align 
          };
        }
        return mc;
      });
      defaultCols.sort((a, b) => {
        const idxA = savedConfig.findIndex(sc => sc.id === a.id);
        const idxB = savedConfig.findIndex(sc => sc.id === b.id);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }
    setColumnConfig(defaultCols);
  }, [searchParams]);

  const fetchReport = async (activeFilters = filters) => {
    if (!activeFilters.party) {
      setData([]);
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        from_date: activeFilters.from_date,
        to_date: activeFilters.to_date,
        party_type: activeFilters.party_type,
        party: activeFilters.party
      };

      const params = new URLSearchParams(payload);
      const res = await authFetchBase(`custom_retailpos.custom_retailpos.retail_api.retail.get_general_ledger_report?${params.toString()}`);
      const result = await res.json();
      const payloadData = result.message || result;

      if (payloadData.status === 'success' || payloadData.data) {
        setData(payloadData.data || []);
        setSuccess('Report generated successfully');
      } else {
        setError(payloadData.message || 'Failed to fetch report data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterUpdate = (key, value) => {
    const next = { ...filters, [key]: value };
    // Clear party if changing party_type
    if (key === 'party_type') {
      next.party = '';
      setSelectedPartyObj(null);
    }
    setFilters(next);
    
    // Sync URL search params
    const newParams = {};
    if (next.from_date) newParams.from_date = next.from_date;
    if (next.to_date) newParams.to_date = next.to_date;
    if (next.party_type) newParams.party_type = next.party_type;
    if (next.party) newParams.party = next.party;
    setSearchParams(newParams);
  };

  const handleColumnUpdate = (newConfig) => {
    if (!newConfig) {
      localStorage.removeItem('general_ledger_columns');
      const defaultCols = DEFAULT_GL_COLUMNS.map(c => ({
        id: c.id,
        label: c.label,
        visible: true,
        width: c.width,
        align: ['debit', 'credit', 'balance'].includes(c.id) ? 'right' : 'left',
        original: c
      }));
      setColumnConfig(defaultCols);
      return;
    }
    // Normalize visible property
    const normalized = newConfig.map(col => ({
      ...col,
      visible: col.visible !== undefined ? col.visible : (col.show !== undefined ? col.show : true)
    }));
    setColumnConfig(normalized);
    localStorage.setItem('general_ledger_columns', JSON.stringify(normalized));
  };

  // Search Customers/Suppliers dynamically from backend API
  const fetchPartiesAPI = async (query) => {
    try {
      const endpoint = filters.party_type === 'Customer'
        ? 'kyle_retail.retail_api.api.get_customers_list'
        : 'kyle_retail.retail_api.api.get_suppliers_list';
      
      const res = await authFetchBase(`${endpoint}?search=${encodeURIComponent(query || '')}&limit=20`);
      if (!res.ok) return [];
      const json = await res.json();
      const list = json.message?.data || json.data || [];
      
      return list.map(item => ({
        name: item.name,
        label: filters.party_type === 'Customer' ? item.customer_name : item.supplier_name,
        customer_name: item.customer_name,
        supplier_name: item.supplier_name
      }));
    } catch (err) {
      console.error('Fetch parties error:', err);
      return [];
    }
  };

  // Metric Calculation Helpers
  const totalDebit = data.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0);
  const totalCredit = data.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0);
  const finalBalance = data.length > 0 ? parseFloat(data[data.length - 1].balance) || 0 : 0;
  
  // CSV Export
  const exportCSV = () => {
    if (data.length === 0) return;
    const activeCols = columnConfig.filter(c => c.visible !== false);
    const headers = activeCols.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row => {
      return activeCols.map(col => {
        let val = '';
        if (col.id === 'posting_date') val = row.posting_date;
        else if (col.id === 'voucher_type') val = row.voucher_type;
        else if (col.id === 'voucher_no') val = row.voucher_no;
        else if (col.id === 'against') val = row.against;
        else if (col.id === 'debit') val = row.debit;
        else if (col.id === 'credit') val = row.credit;
        else if (col.id === 'balance') val = row.balance;
        else if (col.id === 'remarks') val = row.remarks;

        const stringVal = val !== null && val !== undefined ? String(val) : '';
        return `"${stringVal.replace(/"/g, '""')}"`;
      }).join(',');
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `General_Ledger_${filters.party_type}_${filters.party || 'Report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackClick = () => {
    if (filters.party_type === 'Customer' && filters.party) {
      navigate('/customerlist', { state: { search: filters.party } });
    } else if (filters.party_type === 'Supplier' && filters.party) {
      navigate('/supplierlist', { state: { search: filters.party } });
    } else {
      navigate(-1);
    }
  };

  // Render voucher_no cell — clickable link or plain text
  const renderVoucherNoCell = (row) => {
    const url = getVoucherUrl(row.voucher_type, row.voucher_no);
    if (url) {
      return (
        <span
          onClick={() => navigate(url)}
          className="glr-doc-link"
        >
          {row.voucher_no}
          <ExternalLink size={12} color="#10b981" />
        </span>
      );
    }
    return row.voucher_no;
  };

  const visibleColumns = columnConfig.filter(c => c.visible !== false);

  return (
    <div className="glr-container">
      
      {/* 1. Header */}
      <header className="glr-header no-print">
        <div className="glr-header-title-box">
          <button onClick={handleBackClick} className="glr-btn-back">
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>
          <div className="glr-icon-badge">
            <FileText size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="glr-title">General Ledger Report</h1>
              <span className="glr-tag">Audit Ledger</span>
            </div>
            <p className="glr-subtitle">Chronological listing of account debit, credit, and running balance logs</p>
          </div>
        </div>

        <div className="glr-actions">
          <button onClick={() => window.print()} className="glr-btn-secondary">
            <Printer size={15} /> 
            <span>Print</span>
          </button>
          <button onClick={exportCSV} disabled={data.length === 0} className="glr-btn-primary">
            <Download size={15} /> 
            <span>Export CSV</span>
          </button>
          <button 
            className="glr-btn-icon" 
            onClick={() => setShowConfigModal(true)}
            title="Configure Columns"
          >
            <Settings size={18} />
          </button>
          <button 
            onClick={() => fetchReport(filters)}
            disabled={loading}
            className="glr-btn-icon"
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">General Ledger Report</h1>
            <p className="text-xs text-slate-600 mt-1">Party: {filters.party || 'All'} ({filters.party_type})</p>
          </div>
          <div className="text-right text-xs font-bold text-slate-700">
            <div><b>Period:</b> {filters.from_date} to {filters.to_date}</div>
            <div><b>Closing Balance:</b> AED {finalBalance.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <main className="glr-main-body">
        
        {/* 2. KPI Summary Metric Cards */}
        <div className="glr-kpi-grid">
          <div className="glr-kpi-card slate">
            <div className="glr-kpi-header">
              <span className="glr-kpi-title">Transactions</span>
              <div className="glr-kpi-icon-pill">
                <ClipboardList size={16} />
              </div>
            </div>
            <div>
              <div className="glr-kpi-value">
                <span>{data.length}</span>
              </div>
              <div className="glr-kpi-subtext">
                Ledger Records Count
              </div>
            </div>
          </div>

          <div className="glr-kpi-card blue">
            <div className="glr-kpi-header">
              <span className="glr-kpi-title">Total Debit</span>
              <div className="glr-kpi-icon-pill">
                <TrendingUp size={16} />
              </div>
            </div>
            <div>
              <div className="glr-kpi-value">
                <DirhamIcon size={18} />
                <span>{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="glr-kpi-subtext" style={{ color: '#2563eb' }}>
                Accumulated Period Debits
              </div>
            </div>
          </div>

          <div className="glr-kpi-card red">
            <div className="glr-kpi-header">
              <span className="glr-kpi-title">Total Credit</span>
              <div className="glr-kpi-icon-pill">
                <TrendingDown size={16} />
              </div>
            </div>
            <div>
              <div className="glr-kpi-value">
                <DirhamIcon size={18} />
                <span>{totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="glr-kpi-subtext" style={{ color: '#dc2626' }}>
                Accumulated Period Credits
              </div>
            </div>
          </div>

          <div className="glr-kpi-card emerald">
            <div className="glr-kpi-header">
              <span className="glr-kpi-title">Net Balance Change</span>
              <div className="glr-kpi-icon-pill">
                <DollarSign size={16} />
              </div>
            </div>
            <div>
              <div className="glr-kpi-value">
                <DirhamIcon size={18} />
                <span>{finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="glr-kpi-subtext" style={{ color: '#059669' }}>
                Period Closing Balance Change
              </div>
            </div>
          </div>
        </div>

        {/* 3. Filters Bar */}
        <div className="glr-filter-card no-print">
          <div className="glr-filter-inputs">
            {/* From Date */}
            <div className="glr-field-block">
              <label className="glr-label">
                <Calendar size={12} color="#059669" />
                From Date
              </label>
              <input 
                type="date" 
                className="glr-input" 
                value={filters.from_date}
                onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
              />
            </div>
            
            {/* To Date */}
            <div className="glr-field-block">
              <label className="glr-label">
                <Calendar size={12} color="#059669" />
                To Date
              </label>
              <input 
                type="date" 
                className="glr-input" 
                value={filters.to_date}
                onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
              />
            </div>

            {/* Party Type */}
            <div className="glr-field-block" style={{ flex: '0.8 1 150px' }}>
              <label className="glr-label">Party Type</label>
              <div style={{ position: 'relative' }}>
                <select
                  className="glr-select"
                  value={filters.party_type}
                  onChange={(e) => handleFilterUpdate('party_type', e.target.value)}
                  style={{ paddingRight: '2rem' }}
                >
                  <option value="Customer">Customer</option>
                  <option value="Supplier">Supplier</option>
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
              </div>
            </div>

            {/* Target Party Dropdown */}
            <div className="glr-field-block" style={{ flex: '1.5 1 250px' }}>
              <label className="glr-label">Target {filters.party_type}</label>
              <CustomSearchDropdown
                placeholder={`Search & select ${filters.party_type}...`}
                value={selectedPartyObj}
                onSelect={(item) => {
                  setSelectedPartyObj(item);
                  handleFilterUpdate('party', item ? item.name : '');
                }}
                fetchData={fetchPartiesAPI}
                optionsLabel="label"
                themeColor="#10b981"
              />
            </div>
          </div>

          <button 
            className="glr-btn-reset"
            onClick={() => {
              const reset = { 
                from_date: getDate30DaysAgo(), 
                to_date: getTodayDate(), 
                party_type: 'Customer',
                party: ''
              };
              setSelectedPartyObj(null);
              setFilters(reset);
              setSearchParams(reset);
            }}
          >
            Reset
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{ padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 'bold' }}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* 4. Table Card */}
        <div className="glr-table-card">
          <div className="glr-table-header">
            <h3 className="glr-table-heading">
              <FileText size={18} color="#10b981" />
              <span>General Ledger Transactions</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>
              <span>Found <b>{data.length}</b> entries</span>
              {loading && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                  <RefreshCw size={14} className="animate-spin" /> Compiling...
                </span>
              )}
            </div>
          </div>

          <div className="glr-table-wrapper">
            <table className="glr-table">
              <thead>
                <tr>
                  {visibleColumns.map(col => (
                    <th 
                      key={col.id} 
                      style={{ 
                        width: col.width, 
                        minWidth: col.width,
                        textAlign: col.align
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
                    <td colSpan={visibleColumns.length || 1} style={{ padding: '5rem 0', textAlign: 'center' }}>
                      <Loader2 size={32} color="#10b981" className="animate-spin" style={{ margin: '0 auto' }} />
                      <p style={{ marginTop: '0.75rem', fontWeight: 800, color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compiling General Ledger...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length || 1} style={{ padding: '5rem 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                      {filters.party ? 'No ledger entries found for the selected criteria.' : 'Please select a Customer or Supplier to view their ledger.'}
                    </td>
                  </tr>
                ) : (
                  data.map((row, idx) => (
                    <tr key={row.name || idx}>
                      {visibleColumns.map(col => {
                        let cellValue = row[col.id];
                        if (['debit', 'credit', 'balance'].includes(col.id)) {
                          cellValue = cellValue !== undefined && cellValue !== null ? parseFloat(cellValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                        }

                        // Render voucher_no as clickable link
                        if (col.id === 'voucher_no') {
                          return (
                            <td 
                              key={col.id}
                              style={{ 
                                textAlign: col.align,
                                width: col.width, 
                                minWidth: col.width
                              }}
                            >
                              {renderVoucherNoCell(row)}
                            </td>
                          );
                        }

                        return (
                          <td 
                            key={col.id}
                            style={{ 
                              textAlign: col.align,
                              fontFamily: ['debit', 'credit', 'balance', 'posting_date', 'voucher_no'].includes(col.id) ? 'ui-monospace, monospace' : 'inherit',
                              fontWeight: col.id === 'balance' ? 800 : 'inherit',
                              color: col.id === 'balance' ? '#0f172a' : (col.id === 'debit' ? '#1d4ed8' : (col.id === 'credit' ? '#b91c1c' : '#334155')),
                              width: col.width, 
                              minWidth: col.width,
                              maxWidth: col.width,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={String(col.id === 'debit' && parseFloat(row.debit) === 0 ? '-' : col.id === 'credit' && parseFloat(row.credit) === 0 ? '-' : (cellValue ?? ''))}
                          >
                            {col.id === 'debit' && parseFloat(row.debit) === 0 ? '-' :
                             col.id === 'credit' && parseFloat(row.credit) === 0 ? '-' :
                             (cellValue ?? '-')}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              {data.length > 0 && (
                <tfoot>
                  <tr>
                    {visibleColumns.map((col, cIdx) => {
                      if (cIdx === 0) {
                        return <td key={col.id} style={{ textAlign: col.align }}>TOTAL</td>;
                      }
                      if (col.id === 'debit') {
                        return <td key={col.id} style={{ textAlign: col.align, fontFamily: 'monospace', color: '#1d4ed8' }}>{totalDebit.toFixed(2)}</td>;
                      }
                      if (col.id === 'credit') {
                        return <td key={col.id} style={{ textAlign: col.align, fontFamily: 'monospace', color: '#b91c1c' }}>{totalCredit.toFixed(2)}</td>;
                      }
                      if (col.id === 'balance') {
                        return <td key={col.id} style={{ textAlign: col.align, fontFamily: 'monospace', color: '#059669', fontSize: '0.95rem' }}>AED {finalBalance.toFixed(2)}</td>;
                      }
                      return <td key={col.id}></td>;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

      </main>

      <ColumnConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={columnConfig}
        onUpdate={handleColumnUpdate}
        doctype="General Ledger Report"
        themeColor="#10b981"
      />
    </div>
  );
}

export default GeneralLedgerReport;
