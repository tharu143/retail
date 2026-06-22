import React, { useState, useEffect } from 'react';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Search, Filter, Palette, RefreshCw, 
    Download, Printer, ChevronDown, Truck, Package, ExternalLink, Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Admin/SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';

function PurchaseReport() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [columnConfig, setColumnConfig] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Theme Hook
  const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, toggleTheme } = useLegacyTheme();


  const [filters, setFilters] = useState({ 
    from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    supplier: '', 
    item_code: '' 
  });
  const [suppliers, setSuppliers] = useState([]);

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  // Apply Theme Effect removed — handled by hook


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
        const fetchedCols = payload.columns || [];
        setColumns(fetchedCols);
        
        // Merge with local storage config
        const savedConfigStr = localStorage.getItem('purchase_report_columns');
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
        width: (c.width ? c.width + 'px' : '150px'),
        align: c.align || (c.fieldtype === 'Currency' || c.fieldtype === 'Float' ? 'right' : 'left'),
        original: c
      }));
      setColumnConfig(defaultCols);
      return;
    }
    setColumnConfig(newConfig);
    localStorage.setItem('purchase_report_columns', JSON.stringify(newConfig));
  };

  return (
    <div className="so-page">
      <style dangerouslySetInnerHTML={{__html: `
        .so-filter-bar input.so-filter-input-icon,
        .so-filter-bar select.so-filter-input-icon {
          padding-left: 2.5rem !important;
        }
      `}} />
      
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

          <button className="so-btn-secondary" style={{ height: '38px', padding: '0 1rem' }}>
             <Printer size={16} /> Print
          </button>
          <button className="so-btn-primary" style={{ height: '38px', padding: '0 1.25rem' }}>
             <Download size={16} /> Export
          </button>
          <button 
            className="so-btn-secondary" 
            style={{ height: '38px', padding: '0 0.75rem' }}
            onClick={() => setShowConfigModal(true)}
            title="Configure Columns"
          >
             <Settings size={16} style={{ color: themeColor }} />
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
                 className="so-filter-input so-filter-input-icon" 
                 value={filters.from_date}
                 onChange={(e) => handleFilterUpdate('from_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>
          
          <div style={{ flex: '1 1 180px' }}>
            <label className="so-filter-label">To Date</label>
            <div className="so-relative">
               <Calendar size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
               <input 
                 type="date" 
                 className="so-filter-input so-filter-input-icon" 
                 value={filters.to_date}
                 onChange={(e) => handleFilterUpdate('to_date', e.target.value)}
                 onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                 onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
               />
            </div>
          </div>

          <div style={{ flex: '1 1 250px' }}>
            <label className="so-filter-label">Vendor / Supplier</label>
            <div className="so-relative">
               <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
               <select 
                 className="so-filter-select so-filter-input-icon" 
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
              <table className="so-table premium-stock-table" style={{ tableLayout: 'fixed', minWidth: '100%', width: 'max-content' }}>
                <thead>
                  <tr>
                    {columnConfig.filter(c => c.visible).map((col, i) => (
                      <th key={col.id} style={{ width: col.width, minWidth: col.width, maxWidth: col.width, textAlign: col.align }}>
                        {col.label}
                      </th>
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
                        {columnConfig.filter(c => c.visible).map((col, cIdx) => {
                          const fieldname = col.original.fieldname;
                          const cellValue = row[fieldname];
                          return (
                            <td 
                              key={col.id} 
                              style={{ 
                                textAlign: col.align,
                                fontFamily: col.original.fieldtype === 'Currency' || col.original.fieldtype === 'Float' ? 'monospace' : 'inherit',
                                width: col.width,
                                minWidth: col.width,
                                maxWidth: col.width,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={String(cellValue)}
                            >
                              {cellValue !== null && cellValue !== undefined ? (
                                  (fieldname === 'name' || fieldname === 'voucher_no') ? (
                                      <span onClick={() => navigate('/purchaseinvoicelist', { state: { search: cellValue } })} className="group flex items-center gap-1.5 hover:text-indigo-600 transition-colors underline-offset-4 hover:underline cursor-pointer" style={{ justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                                          {cellValue}
                                          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />
                                      </span>
                                  ) : fieldname === 'item_code' ? (
                                      <span onClick={() => navigate('/itemlist', { state: { search: cellValue } })} className="code-capsule group flex items-center gap-1.5 w-fit hover:text-indigo-600 transition-colors cursor-pointer" style={{ marginLeft: col.align === 'right' ? 'auto' : '0' }}>
                                          {cellValue}
                                          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </span>
                                  ) : typeof cellValue === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('rate')) ? 
                                  cellValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 
                                  cellValue
                              ) : '-'}
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
        doctype="Purchase Report"
        themeColor={themeColor}
      />
    </div>
  );
}

export default PurchaseReport;