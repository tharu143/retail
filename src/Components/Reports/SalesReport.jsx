import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Search, Filter, Palette, RefreshCw, 
    Download, Printer, ChevronDown, TrendingUp, DollarSign, CreditCard, Layers, Zap, Coins
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Admin/SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import PrintConfigModal from './PrintConfigModal';

function SalesReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
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
        setColumns(payload.columns || []);
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
      
      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title flex items-center gap-2">
            <FileText size={22} style={{ color: themeColor }} />
            Sales Summary Report
          </h1>
          <p className="so-page-subtitle">Aggregate data of all POS transactions and payment modes</p>
        </div>
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', background: '#f8fafc',
              border: `1.5px solid ${themeColor}`, borderRadius: '0.5rem',
              fontSize: '0.75rem', fontWeight: 800, color: themeColor,
              cursor: 'pointer', transition: 'all 0.2s',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}
          >
            <Palette size={14} /> {isGreen ? 'BLUE' : 'GREEN'}
          </button>

          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 0.25rem' }}></div>

          <button onClick={handlePrint} className="so-btn-secondary" style={{ height: '38px', padding: '0 1rem' }}>
             <Printer size={16} /> Print
          </button>
          <button onClick={handleExportCSV} className="so-btn-primary" style={{ height: '38px', padding: '0 1.25rem', background: themeColor, borderColor: themeColor }}>
             <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="so-layout">
        {/* 2. HORIZONTAL FILTERS */}
        <div className="so-filter-bar no-print flex flex-wrap gap-4 p-4 bg-white border-b border-slate-200">
          <div style={{ flex: '1 1 200px' }}>
            <label className="so-filter-label">From Date</label>
            <div className="so-relative">
               <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
               <input 
                 type="date" 
                 className="so-filter-input" 
                 style={{ paddingLeft: '2.5rem' }}
                 value={filters.from_date}
                 onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>
          
          <div style={{ flex: '1 1 200px' }}>
            <label className="so-filter-label">To Date</label>
            <div className="so-relative">
               <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
               <input 
                 type="date" 
                 className="so-filter-input" 
                 style={{ paddingLeft: '2.5rem' }}
                 value={filters.to_date}
                 onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>

          {/* DYNAMIC ROLE-BASED WAREHOUSE FILTER */}
          {isAdmin ? (
            <div style={{ flex: '1 1 250px' }}>
              <label className="so-filter-label">Branch / Warehouse</label>
              <div className="so-relative">
                 <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                 <select 
                   className="so-filter-select" 
                   style={{ paddingLeft: '2.5rem' }}
                   value={filters.warehouse}
                   onChange={(e) => handleFilterUpdate('warehouse', e.target.value)}
                 >
                   <option value="">All Branches</option>
                   {warehouses.map(w => (
                     <option key={w.value} value={w.value}>{w.label || w.value}</option>
                   ))}
                 </select>
                 <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }} />
              </div>
            </div>
          ) : warehouse ? (
            <div style={{ flex: '1 1 250px' }}>
              <label className="so-filter-label">Active Branch</label>
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
            <label className="so-filter-label">Filter by Customer</label>
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
            <label className="so-filter-label">Payment Mode</label>
            <div className="so-relative">
               <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <select 
                 className="so-filter-select" 
                 style={{ paddingLeft: '2.5rem' }}
                 value={filters.payment_mode}
                 onChange={(e) => handleFilterUpdate('payment_mode', e.target.value)}
               >
                 <option value="">All Payment Modes</option>
                 <option value="Cash">Cash</option>
                 <option value="Card">Card</option>
                 <option value="InstaPay">InstaPay</option>
                 <option value="Credit">Credit Sales</option>
               </select>
               <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }} />
            </div>
          </div>

          <button 
             className="so-clear-btn" 
             style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0, alignSelf: 'flex-end' }}
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
            Reset
          </button>
        </div>
 
        {/* 3. MAIN CONTENT AREA */}
        <main className="so-content" style={{ padding: '1.5rem 2rem' }}>
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
              onClick={() => window.open('/#/salesreport', '_blank')}
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
              onClick={() => window.open('/#/salesreport?payment_mode=Cash', '_blank')}
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
              onClick={() => window.open('/#/salesreport?payment_mode=Card', '_blank')}
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
              onClick={() => window.open('/#/salesreport?payment_mode=InstaPay', '_blank')}
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
              onClick={() => window.open('/#/salesreport?payment_mode=Credit', '_blank')}
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
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p className="so-list-meta">Found <b>{data.length}</b> records matching sequence</p>
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: themeColor, fontSize: '0.75rem', fontWeight: 700 }}>
               <Loader2 size={16} className="animate-spin" /> EXECUTING QUERY...
            </div>}
          </div>

          <div className="so-table-card">
            <div className="so-table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="so-table">
                <thead>
                  <tr>
                    {columns.filter(col => selectedPrintColumns.includes(col.fieldname)).map((col, i) => (
                      <th key={i}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.filter(col => selectedPrintColumns.includes(col.fieldname)).length || 1} className="so-empty" style={{ padding: '6rem 0' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                        <p style={{ marginTop: '1rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Processing Data Streams...</p>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.filter(col => selectedPrintColumns.includes(col.fieldname)).length || 1} className="so-empty" style={{ padding: '6rem 0' }}>
                        <div style={{ opacity: 0.2, marginBottom: '1rem' }}>
                           <FileText size={48} style={{ margin: '0 auto' }} />
                        </div>
                        <p>No transactions found for the selected criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {columns.filter(col => selectedPrintColumns.includes(col.fieldname)).map((col, cIdx) => (
                          <td key={cIdx} style={col.label?.toLowerCase().includes('amount') || col.label?.toLowerCase().includes('total') ? { textAlign: 'right', fontWeight: 600 } : {}}>
                            {row[col.fieldname] !== null && row[col.fieldname] !== undefined ? (
                                typeof row[col.fieldname] === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('amount')) ? 
                                row[col.fieldname].toLocaleString(undefined, { minimumFractionDigits: 2 }) : 
                                String(row[col.fieldname]).replace(' - KSPL', '')
                            ) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
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
    </div>
  );
}

export default SalesReport;