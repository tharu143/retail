import React, { useState, useEffect } from 'react';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Search, Filter, Palette, RefreshCw, 
    Download, Printer, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Admin/SalesOrder.css';

function SalesReport() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Theme Toggle Support
  const [rptTheme, setRptTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = rptTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';
  const themeHeaderBg = isGreen ? '#f2fdf9' : '#eff6ff';
  const themeHeaderText = isGreen ? '#0d9488' : '#1d4ed8';

  const [filters, setFilters] = useState({ 
    from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0], // 1st of current month
    to_date: new Date().toISOString().split('T')[0],
    customer: '' 
  });
  const [customers, setCustomers] = useState([]);

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  // Apply Theme Effect
  useEffect(() => {
    localStorage.setItem('legacySubTheme', rptTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [rptTheme, themeColor, themeColorHover, themeLight]);

  useEffect(() => {
    fetchCustomers();
    fetchReport(filters);
  }, []);

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

  const fetchReport = async (activeFilters = filters) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const params = new URLSearchParams(activeFilters);
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

  return (
    <div className="so-page">
      
      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <FileText size={22} />
            Sales Summary Report
          </h1>
          <p className="so-page-subtitle">Aggregate data of all POS transactions and payment modes</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          
          <button
            onClick={() => setRptTheme(isGreen ? 'blue' : 'green')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', background: '#f8fafc',
              border: `1.5px solid ${themeColor}`, borderRadius: '0.5rem',
              fontSize: '0.75rem', fontWeight: 800, color: themeColor,
              cursor: 'pointer', transition: 'all 0.2s',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}
          >
            <Palette size={14} /> {rptTheme.toUpperCase()}
          </button>

          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 0.25rem' }}></div>

          <button className="so-btn-secondary" style={{ height: '38px', padding: '0 1rem' }}>
             <Printer size={16} /> Print
          </button>
          <button className="so-btn-primary" style={{ height: '38px', padding: '0 1.25rem' }}>
             <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="so-layout">
        {/* 2. HORIZONTAL FILTERS */}
        <div className="so-filter-bar">
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
               />
            </div>
          </div>

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
             style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0 }}
             onClick={() => {
               const reset = { from_date: '', to_date: '', customer: '' };
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
                      <tr key={idx}>
                        {columns.map((col, cIdx) => (
                          <td key={cIdx} style={col.label?.toLowerCase().includes('amount') || col.label?.toLowerCase().includes('total') ? { textAlign: 'right', fontWeight: 600 } : {}}>
                            {row[col.fieldname] !== null && row[col.fieldname] !== undefined ? (
                                typeof row[col.fieldname] === 'number' && col.label?.toLowerCase().includes('total') ? 
                                row[col.fieldname].toLocaleString(undefined, { minimumFractionDigits: 2 }) : 
                                row[col.fieldname]
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
    </div>
  );
}

export default SalesReport;