import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
    Loader2, FileText, AlertCircle, Calendar, 
    RefreshCw, Download, Printer, 
    ChevronDown, DollarSign, TrendingUp, TrendingDown, ClipboardList, ChevronLeft, ExternalLink, Settings
} from 'lucide-react';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
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
  { id: 'posting_date', label: 'Posting Date', visible: true, width: 120 },
  { id: 'voucher_type', label: 'Voucher Type', visible: true, width: 130 },
  { id: 'voucher_no', label: 'Voucher No', visible: true, width: 150 },
  { id: 'against', label: 'Against Account', visible: true, width: 180 },
  { id: 'debit', label: 'Debit', visible: true, width: 110 },
  { id: 'credit', label: 'Credit', visible: true, width: 110 },
  { id: 'balance', label: 'Balance', visible: true, width: 120 },
  { id: 'remarks', label: 'Remarks', visible: true, width: 220 }
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

  // Theme Hook
  const { legacySubTheme, themeColor, toggleTheme } = useLegacyTheme();

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

    // Column Config initialization
    const savedConfigStr = localStorage.getItem('general_ledger_columns');
    const savedConfig = savedConfigStr ? JSON.parse(savedConfigStr) : null;
    
    let defaultCols = DEFAULT_GL_COLUMNS.map(c => ({
      id: c.id,
      label: c.label,
      show: c.visible,
      width: c.width + 'px',
      align: ['debit', 'credit', 'balance'].includes(c.id) ? 'right' : 'left',
      original: c
    }));

    if (savedConfig && Array.isArray(savedConfig)) {
      const configMap = {};
      savedConfig.forEach(sc => configMap[sc.id] = sc);
      defaultCols = defaultCols.map(mc => {
        if (configMap[mc.id]) {
          return { ...mc, show: configMap[mc.id].show, width: configMap[mc.id].width, align: configMap[mc.id].align };
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
        visible: c.visible,
        width: c.width + 'px',
        align: ['debit', 'credit', 'balance'].includes(c.id) ? 'right' : 'left',
        original: c
      }));
      setColumnConfig(defaultCols);
      return;
    }
    setColumnConfig(newConfig);
    localStorage.setItem('general_ledger_columns', JSON.stringify(newConfig));
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
        // CustomSearchDropdown displays matching optionsLabel
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
    const activeCols = columnConfig.filter(c => c.show);
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
          style={{
            color: themeColor,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.opacity = '1'; }}
        >
          {row.voucher_no}
          <ExternalLink size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
        </span>
      );
    }
    return row.voucher_no;
  };

  return (
    <div className="so-page general-ledger-report-container">
      
      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button onClick={handleBackClick} className="px-3.5 py-2 bg-white text-gray-500 rounded-lg hover:bg-gray-100 transition-all border border-gray-200 flex items-center gap-1.5 shadow-sm">
            <ChevronLeft size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
          </button>
          <div>
            <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
              <FileText size={22} style={{ color: themeColor }} />
              General Ledger Report
            </h1>
            <p className="so-page-subtitle" style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Chronological listing of account debit and credit logs
            </p>
          </div>
        </div>
        
        <div className="header-actions">
          <button onClick={toggleTheme} className="theme-toggle-btn" style={{ borderColor: themeColor, color: themeColor }}>
            {legacySubTheme.toUpperCase()} THEME
          </button>
          <div className="action-divider"></div>
          <button className="so-btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: 'white', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
             <Printer size={16} /> Print
          </button>
          <button className="so-btn-primary" onClick={exportCSV} disabled={data.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: themeColor, color: 'white', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', opacity: data.length === 0 ? 0.6 : 1 }}>
             <Download size={16} /> Export CSV
          </button>
          <button 
            className="so-btn-secondary" 
            style={{ height: '38px', padding: '0 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
            onClick={() => setShowConfigModal(true)}
            title="Configure Columns"
          >
             <Settings size={16} style={{ color: themeColor }} />
          </button>
        </div>
      </div>

      <div className="so-layout">
        
        {/* 2. SUMMARY METRIC CARDS */}
        <div className="metrics-grid">
          <div className="metric-card opening">
            <div className="metric-icon-box" style={{ background: '#64748b15', color: '#64748b' }}>
              <ClipboardList size={22} />
            </div>
            <div className="metric-info">
              <h3>Transactions</h3>
              <p className="metric-value">{data.length}</p>
              <span className="metric-sub">Ledger Records Count</span>
            </div>
          </div>

          <div className="metric-card debit">
            <div className="metric-icon-box" style={{ background: '#3b82f615', color: '#3b82f6' }}>
              <TrendingUp size={22} />
            </div>
            <div className="metric-info">
              <h3 className="flex items-center gap-1">Total Debit</h3>
              <p className="metric-value"><DirhamIcon size={16} /> {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <span className="metric-sub">Accumulated Period Debits</span>
            </div>
          </div>

          <div className="metric-card credit">
            <div className="metric-icon-box" style={{ background: '#ef444415', color: '#ef4444' }}>
              <TrendingDown size={22} />
            </div>
            <div className="metric-info">
              <h3>Total Credit</h3>
              <p className="metric-value"><DirhamIcon size={16} /> {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <span className="metric-sub">Accumulated Period Credits</span>
            </div>
          </div>

          <div className="metric-card closing">
            <div className="metric-icon-box" style={{ background: '#10b98115', color: '#10b981' }}>
              <DollarSign size={22} />
            </div>
            <div className="metric-info">
              <h3>Net Balance Change</h3>
              <p className="metric-value"><DirhamIcon size={16} /> {finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <span className="metric-sub">Period Closing Balance Change</span>
            </div>
          </div>
        </div>

        {/* 3. DYNAMIC HORIZONTAL FILTERS */}
        <div className="so-filter-bar filters-wrapper">
          <div className="filter-input-field flex-2">
            <label className="so-filter-label" style={{ fontSize: '0.675rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>From Date</label>
            <div className="so-relative" style={{ position: 'relative' }}>
               <Calendar size={14} className="input-icon" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: themeColor, zIndex: 10 }} />
               <input 
                 type="date" 
                 className="so-filter-input" 
                 style={{ width: '100%', paddingLeft: '2.25rem', height: '38px', border: '1px solid #cbd5e1', borderRadius: '0.5rem', outline: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                 value={filters.from_date}
                 onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>
          
          <div className="filter-input-field flex-2">
            <label className="so-filter-label" style={{ fontSize: '0.675rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>To Date</label>
            <div className="so-relative" style={{ position: 'relative' }}>
               <Calendar size={14} className="input-icon" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: themeColor, zIndex: 10 }} />
               <input 
                 type="date" 
                 className="so-filter-input" 
                 style={{ width: '100%', paddingLeft: '2.25rem', height: '38px', border: '1px solid #cbd5e1', borderRadius: '0.5rem', outline: 'none', fontSize: '0.75rem', fontWeight: 700 }}
                 value={filters.to_date}
                 onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>

          <div className="filter-input-field flex-2">
            <label className="so-filter-label" style={{ fontSize: '0.675rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Party Type</label>
            <div className="so-relative" style={{ position: 'relative' }}>
              <select
                className="so-filter-select"
                style={{ width: '100%', height: '38px', border: '1px solid #cbd5e1', borderRadius: '0.5rem', outline: 'none', fontSize: '0.75rem', fontWeight: 700, paddingLeft: '0.75rem', appearance: 'none', WebkitAppearance: 'none' }}
                value={filters.party_type}
                onChange={(e) => handleFilterUpdate('party_type', e.target.value)}
              >
                <option value="Customer">Customer</option>
                <option value="Supplier">Supplier</option>
              </select>
              <ChevronDown size={14} className="select-arrow" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
            </div>
          </div>

          <div className="filter-input-field flex-3 dropdown-search-container">
            <label className="so-filter-label" style={{ fontSize: '0.675rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Target {filters.party_type}
            </label>
            <CustomSearchDropdown
              placeholder={`Select ${filters.party_type}...`}
              value={selectedPartyObj}
              onSelect={(item) => {
                setSelectedPartyObj(item);
                handleFilterUpdate('party', item ? item.name : '');
              }}
              fetchData={fetchPartiesAPI}
              optionsLabel="label"
              themeColor={themeColor}
            />
          </div>

          <button 
             className="so-clear-btn" 
             style={{ height: '38px', padding: '0 1.5rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', background: '#f8fafc', color: '#64748b', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
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

        {/* 4. CONTENT VIEWPORT */}
        <main className="so-content stock-table-viewport">
          {error && (
            <div className="report-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.75rem', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
               <AlertCircle size={18} /> {error}
            </div>
          )}

          <div className="results-header">
            <p className="so-list-meta" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#64748b', uppercase: true }}>
              Found <b>{data.length}</b> entries
            </p>
            {loading && (
              <div className="loading-indicator" style={{ color: themeColor }}>
                <Loader2 size={16} className="animate-spin" /> COMPILING GENERAL LEDGER...
              </div>
            )}
          </div>

          <div className="so-table-card table-outer-box">
            <div className="so-table-wrapper scrollable-table-area" style={{ overflowX: 'auto' }}>
              <table className="so-table premium-stock-table" style={{ tableLayout: 'fixed', minWidth: '100%', width: 'max-content' }}>
                <thead>
                  <tr>
                    {columnConfig.filter(c => c.visible).map(col => (
                      <th 
                        key={col.id} 
                        style={{ 
                          width: col.width, 
                          minWidth: col.width,
                          maxWidth: col.width,
                          textAlign: col.align
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={columnConfig.filter(c => c.visible).length} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                        {filters.party ? 'No ledger entries found for the selected criteria.' : 'Please select a Customer or Supplier to view their ledger.'}
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={row.name || idx} className="hover:bg-slate-50/50 transition-colors">
                        {columnConfig.filter(c => c.visible).map(col => {
                          let cellValue = row[col.id];
                          if (['debit', 'credit', 'balance'].includes(col.id)) {
                            cellValue = cellValue !== undefined ? parseFloat(cellValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
                          }

                          // Render voucher_no as clickable link
                          if (col.id === 'voucher_no') {
                            return (
                              <td 
                                key={col.id}
                                style={{ 
                                  textAlign: col.align,
                                  fontFamily: 'monospace',
                                  width: col.width, 
                                  minWidth: col.width,
                                  maxWidth: col.width
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
                                fontFamily: ['debit', 'credit', 'balance', 'posting_date', 'voucher_no'].includes(col.id) ? 'monospace' : 'inherit',
                                fontWeight: col.id === 'balance' ? 700 : 'inherit',
                                width: col.width, 
                                minWidth: col.width,
                                maxWidth: col.width,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={String(col.id === 'debit' && parseFloat(row.debit) === 0 ? '-' : col.id === 'credit' && parseFloat(row.credit) === 0 ? '-' : cellValue)}
                            >
                              {col.id === 'debit' && parseFloat(row.debit) === 0 ? '-' :
                               col.id === 'credit' && parseFloat(row.credit) === 0 ? '-' :
                               cellValue}
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
      
      <ColumnConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={columnConfig}
        onUpdate={handleColumnUpdate}
        doctype="General Ledger Report"
        themeColor={themeColor}
      />
    </div>
  );
}

export default GeneralLedgerReport;
