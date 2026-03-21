import React, { useState, useEffect } from 'react';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Search, Filter, Palette, RefreshCw, 
    Download, Printer, ChevronDown, Truck, Package
} from 'lucide-react';
import '../Admin/SalesOrder.css';

function PurchaseReport() {
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
    from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    supplier: '', 
    item_code: '' 
  });
  const [suppliers, setSuppliers] = useState([]);

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
    fetchSuppliers();
    fetchReport(filters);
  }, []);

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
        setColumns(payload.columns || []);
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

  return (
    <div className="so-page">
      
      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <Truck size={22} />
            Purchase Summary Report
          </h1>
          <p className="so-page-subtitle">Historical breakdown of stock procurement and vendor payouts</p>
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
             <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="so-layout">
        {/* 2. DASHBOARD FILTER STRIP */}
        <div className="so-filter-bar">
          <div style={{ flex: '1 1 180px' }}>
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
          
          <div style={{ flex: '1 1 180px' }}>
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
            <label className="so-filter-label">Vendor / Supplier</label>
            <div className="so-relative">
               <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <select 
                 className="so-filter-select" 
                 style={{ paddingLeft: '2.5rem' }}
                 value={filters.supplier}
                 onChange={(e) => handleFilterUpdate('supplier', e.target.value)}
               >
                 <option value="">All Suppliers</option>
                 {suppliers.map(s => (
                   <option key={s.name} value={s.name}>{s.supplier_name || s.name}</option>
                 ))}
               </select>
            </div>
          </div>

          <button 
             className="so-clear-btn" 
             style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0 }}
             onClick={() => {
               const reset = { from_date: '', to_date: '', supplier: '', item_code: '' };
               setFilters(reset);
               fetchReport(reset);
             }}
          >
            Reset
          </button>
        </div>

        {/* 3. REPORT MATRIX AREA */}
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
            <p className="so-list-meta">Computed <b>{data.length}</b> line entries for this period</p>
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: themeColor, fontSize: '0.75rem', fontWeight: 700 }}>
               <RefreshCw size={16} className="animate-spin" /> FETCHING PROCUREMENT DATA...
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
                      <td colSpan={columns.length || 1} className="so-empty" style={{ padding: '5rem 0' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                        <p style={{ marginTop: '1rem', fontWeight: 700, color: '#94a3b8', fontSize: '0.65rem', textTransform: 'uppercase' }}>Analyzing Inbound Orders...</p>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length || 1} className="so-empty" style={{ padding: '5rem 0' }}>
                        <div style={{ opacity: 0.1, marginBottom: '1rem' }}>
                           <Package size={48} style={{ margin: '0 auto' }} />
                        </div>
                        <p>No procurement records found for the selected vendor/period.</p>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx}>
                        {columns.map((col, cIdx) => (
                          <td key={cIdx} style={
                            col.label?.toLowerCase().includes('amount') || 
                            col.label?.toLowerCase().includes('total') ||
                            col.label?.toLowerCase().includes('qty') ||
                            col.label?.toLowerCase().includes('rate')
                            ? { textAlign: 'right', fontWeight: 600 } : {}
                          }>
                            {row[col.fieldname] !== null && row[col.fieldname] !== undefined ? (
                                typeof row[col.fieldname] === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('rate')) ? 
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

export default PurchaseReport;