import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Search, Filter, Palette, RefreshCw, 
    Download, Printer, ChevronDown, TrendingUp, DollarSign, CreditCard, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Admin/SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

function SalesReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Theme Hook
  const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, themeHeaderBg, themeHeaderText, toggleTheme } = useLegacyTheme();

  // Redux Hook
  const { warehouse, user_roles } = useSelector((state) => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const [filters, setFilters] = useState({ 
    from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0], // 1st of current month
    to_date: new Date().toISOString().split('T')[0],
    customer: '',
    warehouse: ''
  });
  
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [breakdown, setBreakdown] = useState({
    grand_total: 0,
    net_total: 0,
    cash: 0,
    card: 0,
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
        setBreakdown(payload.payment_breakdown || { grand_total: 0, net_total: 0, cash: 0, card: 0, other: 0 });
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
    window.print();
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
            <div className="so-relative">
               <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <select 
                 className="so-filter-select" 
                 style={{ paddingLeft: '2.5rem' }}
                 value={filters.customer}
                 onChange={(e) => handleFilterUpdate('customer', e.target.value)}
               >
                 <option value="">All Customers</option>
                 {customers.map(c => (
                   <option key={c.name} value={c.name}>{c.customer_name || c.name}</option>
                 ))}
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
                 warehouse: isAdmin ? '' : (warehouse || '')
               };
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
            <div className="po-card shadow-sm" style={{ borderLeft: `4px solid ${themeColor}`, padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: themeColor }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Total POS Revenue</span>
                <TrendingUp size={14} style={{ color: themeColor }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#0f172a', display: 'block', marginTop: '0.5rem' }}>
                AED {breakdown.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', display: 'block', marginTop: '0.25rem' }}>Net Total: AED {breakdown.net_total.toFixed(2)}</span>
            </div>

            {/* Card 2: Cash Payments */}
            <div className="po-card shadow-sm" style={{ borderLeft: '4px solid #10b981', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Cash Payments</span>
                <DollarSign size={14} style={{ color: '#10b981' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#047857', display: 'block', marginTop: '0.5rem' }}>
                AED {breakdown.cash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#a7f3d0', display: 'block', marginTop: '0.25rem' }}>Physical Cash Sales</span>
            </div>

            {/* Card 3: Card Payments */}
            <div className="po-card shadow-sm" style={{ borderLeft: '4px solid #3b82f6', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Card Payments</span>
                <CreditCard size={14} style={{ color: '#3b82f6' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#1d4ed8', display: 'block', marginTop: '0.5rem' }}>
                AED {breakdown.card.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#bfdbfe', display: 'block', marginTop: '0.25rem' }}>Credit & Debit Cards</span>
            </div>

            {/* Card 4: Other Payments */}
            <div className="po-card shadow-sm" style={{ borderLeft: '4px solid #a855f7', padding: '1.25rem', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#a855f7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Other Payments</span>
                <Layers size={14} style={{ color: '#a855f7' }} />
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 950, color: '#7e22ce', display: 'block', marginTop: '0.5rem' }}>
                AED {breakdown.other.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#e9d5ff', display: 'block', marginTop: '0.25rem' }}>Cheque, Loyalty, etc.</span>
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
                    {columns.map((col, i) => (
                      <th key={i}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length || 1} className="so-empty" style={{ padding: '6rem 0' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                        <p style={{ marginTop: '1rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Processing Data Streams...</p>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length || 1} className="so-empty" style={{ padding: '6rem 0' }}>
                        <div style={{ opacity: 0.2, marginBottom: '1rem' }}>
                           <FileText size={48} style={{ margin: '0 auto' }} />
                        </div>
                        <p>No transactions found for the selected criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        {columns.map((col, cIdx) => (
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
        @media print {
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
    </div>
  );
}

export default SalesReport;