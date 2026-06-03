import React, { useState, useEffect } from 'react';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Search, Filter, Palette, RefreshCw, 
    Download, Printer, ChevronDown, Package, Tag
} from 'lucide-react';
import '../Admin/SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import PrintConfigModal from './PrintConfigModal';


function ItemWiseSalesReport() {
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

  // Theme Hook
  const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, toggleTheme } = useLegacyTheme();


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

  // Apply Theme Effect removed — handled by hook


  useEffect(() => {
    fetchCustomers();
    fetchItems();
    fetchReport(filters);
  }, []);

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
      const res = await fetch(`${API_PATH}.get_items`, { 
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
        setData(payload.data || []);
        setColumns(payload.columns || []);
        setSuccess(`Loaded ${payload.total_records || payload.data?.length || 0} records`);
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

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  const executePrint = () => {
    setIsPrintModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="so-page">
      
      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <Package size={22} />
            Item-Wise Sales Report
          </h1>
          <p className="so-page-subtitle">Granular breakdown of products, taxes, and profitability</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          <button className="so-btn-primary" style={{ height: '38px', padding: '0 1.25rem' }}>
             <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="so-layout">
        {/* 2. ADVANCED HORIZONTAL FILTERS */}
        <div className="so-filter-bar" style={{ padding: '1rem 1.5rem', gap: '1rem' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label className="so-filter-label">From</label>
            <div className="so-relative">
               <Calendar size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
               <input 
                 type="date" 
                 className="so-filter-input" 
                 style={{ paddingLeft: '2.2rem', fontSize: '0.75rem' }}
                 value={filters.from_date}
                 onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>
          
          <div style={{ flex: '1 1 140px' }}>
            <label className="so-filter-label">To</label>
            <div className="so-relative">
               <Calendar size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
               <input 
                 type="date" 
                 className="so-filter-input" 
                 style={{ paddingLeft: '2.2rem', fontSize: '0.75rem' }}
                 value={filters.to_date}
                 onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label className="so-filter-label">Customer</label>
            <div className="so-relative">
               <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <select 
                 className="so-filter-select" 
                 style={{ paddingLeft: '2.2rem', fontSize: '0.75rem' }}
                 value={filters.customer}
                 onChange={(e) => handleFilterUpdate('customer', e.target.value)}
               >
                 <option value="">All Customers</option>
                 {customers.map(c => <option key={c.name} value={c.name}>{c.customer_name || c.name}</option>)}
               </select>
            </div>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label className="so-filter-label">Item / SKU</label>
            <div className="so-relative">
               <Package size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <select 
                 className="so-filter-select" 
                 style={{ paddingLeft: '2.2rem', fontSize: '0.75rem' }}
                 value={filters.item_code}
                 onChange={(e) => handleFilterUpdate('item_code', e.target.value)}
               >
                 <option value="">All Products</option>
                 {items.map(i => <option key={i.item_code} value={i.item_code}>{i.item_name || i.item_code}</option>)}
               </select>
            </div>
          </div>

          <div style={{ flex: '1 1 160px' }}>
            <label className="so-filter-label">Invoice Ref</label>
            <div className="so-relative">
               <Tag size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <input 
                 type="text" 
                 className="so-filter-input" 
                 placeholder="POS-INV-..."
                 style={{ paddingLeft: '2.2rem', fontSize: '0.75rem' }}
                 value={filters.pos_invoice}
                 onChange={(e) => handleFilterUpdate('pos_invoice', e.target.value)}
               />
            </div>
          </div>

          <button 
             className="so-clear-btn" 
             style={{ width: 'auto', padding: '0 1.25rem', height: '36px', margin: 0, alignSelf: 'flex-end', fontSize: '0.7rem' }}
             onClick={() => {
               const reset = { from_date: '', to_date: '', customer: '', item_code: '', pos_invoice: '' };
               setFilters(reset);
               fetchReport(reset);
             }}
          >
            Clear
          </button>
        </div>

        {/* 3. REPORT DATA AREA */}
        <main className="so-content" style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{ 
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', 
                padding: '0.75rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8.5rem',
                color: '#991b1b', fontSize: '0.8rem', fontWeight: 600
            }}>
               <AlertCircle size={16} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <p className="so-list-meta" style={{ margin: 0 }}>Showing <b>{data.length}</b> line items</p>
            {loading && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: themeColor, fontSize: '0.7rem', fontWeight: 800 }}>
               <RefreshCw size={14} className="animate-spin" /> SYNCING REPORT DATA...
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
                      <td colSpan={columns.filter(col => selectedPrintColumns.includes(col.fieldname)).length || 1} className="so-empty" style={{ padding: '5rem 0' }}>
                        <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                        <p style={{ marginTop: '0.75rem', fontWeight: 700, color: '#94a3b8', fontSize: '0.6rem', textTransform: 'uppercase' }}>Building Report Matrix...</p>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.filter(col => selectedPrintColumns.includes(col.fieldname)).length || 1} className="so-empty" style={{ padding: '5rem 0' }}>
                        <div style={{ opacity: 0.1, marginBottom: '0.75rem' }}>
                           <Package size={40} style={{ margin: '0 auto' }} />
                        </div>
                        <p style={{ fontSize: '0.8rem' }}>No inventory sales records found.</p>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx}>
                        {columns.filter(col => selectedPrintColumns.includes(col.fieldname)).map((col, cIdx) => (
                          <td key={cIdx} style={
                            col.label?.toLowerCase().includes('qty') || 
                            col.label?.toLowerCase().includes('amount') || 
                            col.label?.toLowerCase().includes('total') ||
                            col.label?.toLowerCase().includes('rate')
                            ? { textAlign: 'right', fontWeight: 600 } : {}
                          }>
                            {row[col.fieldname] !== null && row[col.fieldname] !== undefined ? (
                                typeof row[col.fieldname] === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('rate')) ? 
                                row[col.fieldname].toLocaleString(undefined, { minimumFractionDigits: 2 }) : 
                                typeof row[col.fieldname] === 'string' && row[col.fieldname].startsWith('<b>') ?
                                <span dangerouslySetInnerHTML={{ __html: row[col.fieldname] }} /> :
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
            @page {
                size: ${printOrientation};
                margin: 10mm;
            }
            body {
                background: #ffffff !important;
                color: #000000 !important;
            }
            .so-page-header button, .so-filter-bar, .no-print, button, .so-page-header div:nth-child(2) {
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

export default ItemWiseSalesReport;