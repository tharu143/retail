import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
    Loader2, FileText, AlertCircle, CheckCircle2, 
    Calendar, Search, Filter, Palette, RefreshCw, 
    Download, Printer, ChevronDown, Package, Tag, ExternalLink, Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Admin/SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import PrintConfigModal from './PrintConfigModal';
import ColumnConfigModal from '../Purchase/ColumnConfigModal';



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
  }, [warehouse]);

  const fetchCustomers = async () => {
    try {
      const params = new URLSearchParams();
      if (warehouse) params.append('warehouse', warehouse);
      const res = await fetch(`${API_PATH}.get_customers_list_rpt?${params.toString()}`, { 
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
        setData(payload.data || []);
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
        {/* 2. ADVANCED HORIZONTAL FILTERS */}
        <div className="so-filter-bar" style={{ padding: '1rem 1.5rem', gap: '1rem' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label className="so-filter-label">From</label>
            <div className="so-relative">
               <Calendar size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: themeColor }} />
               <input 
                 type="date" 
                 className="so-filter-input so-filter-input-icon" 
                 style={{ fontSize: '0.75rem' }}
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
                 className="so-filter-input so-filter-input-icon" 
                 style={{ fontSize: '0.75rem' }}
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
                 className="so-filter-select so-filter-input-icon" 
                 style={{ fontSize: '0.75rem' }}
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
                 className="so-filter-select so-filter-input-icon" 
                 style={{ fontSize: '0.75rem' }}
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
                 className="so-filter-input so-filter-input-icon" 
                 placeholder="POS-INV-..."
                 style={{ fontSize: '0.75rem' }}
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
               setData([]);
               setHasGenerated(false);
             }}
          >
            Clear
          </button>
          
          <button 
             className="so-btn-primary" 
             style={{ width: 'auto', padding: '0 1.5rem', height: '36px', margin: 0, alignSelf: 'flex-end', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
             onClick={() => fetchReport(filters)}
             disabled={loading}
          >
             {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
             Generate Report
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
              <table className="so-table premium-stock-table" style={{ tableLayout: 'fixed', minWidth: '100%', width: 'max-content' }}>
                <thead>
                  <tr>
                    {columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).map((col, i) => (
                      <th key={col.id} style={{ width: col.width, minWidth: col.width, maxWidth: col.width, textAlign: col.align }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && data.length === 0 ? (
                    <tr>
                      <td colSpan={columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).length || 1} className="so-empty" style={{ padding: '5rem 0' }}>
                        <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                        <p style={{ marginTop: '0.75rem', fontWeight: 700, color: '#94a3b8', fontSize: '0.6rem', textTransform: 'uppercase' }}>Building Report Matrix...</p>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).length || 1} className="so-empty" style={{ padding: '5rem 0' }}>
                        <div style={{ opacity: 0.1, marginBottom: '0.75rem' }}>
                           <Package size={40} style={{ margin: '0 auto' }} />
                        </div>
                        <p style={{ fontSize: '0.8rem' }}>{hasGenerated ? "No inventory sales records found." : "Select filters and click 'Generate Report' to view data."}</p>
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx}>
                        {columnConfig.filter(c => c.visible && selectedPrintColumns.includes(c.id)).map((col, cIdx) => {
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
                                whiteSpace: 'nowrap',
                                fontWeight: (col.label?.toLowerCase().includes('qty') || col.label?.toLowerCase().includes('amount') || col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('rate')) ? 600 : 400
                              }}
                              title={String(cellValue)}
                            >
                              {cellValue !== null && cellValue !== undefined ? (
                                  (fieldname === 'name' || fieldname === 'voucher_no' || fieldname === 'pos_invoice') ? (
                                      <span onClick={() => navigate('/salesinvoicelist', { state: { search: cellValue } })} className="group flex items-center gap-1.5 hover:text-indigo-600 transition-colors underline-offset-4 hover:underline cursor-pointer" style={{ fontWeight: 600, color: '#475569', justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                                          {String(cellValue).replace(' - KSPL', '')}
                                      </span>
                                  ) : fieldname === 'item_code' ? (
                                      <span onClick={() => navigate('/itemlist', { state: { search: cellValue } })} className="group flex items-center gap-1.5 w-fit hover:text-indigo-600 transition-colors cursor-pointer" style={{ marginLeft: col.align === 'right' ? 'auto' : '0' }}>
                                          {String(cellValue).replace(' - KSPL', '')}
                                      </span>
                                  ) : typeof cellValue === 'number' && (col.label?.toLowerCase().includes('total') || col.label?.toLowerCase().includes('rate')) ? 
                                  cellValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : 
                                  typeof cellValue === 'string' && cellValue.startsWith('<b>') ?
                                  <span dangerouslySetInnerHTML={{ __html: cellValue }} /> :
                                  String(cellValue).replace(' - KSPL', '')
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
      
      <ColumnConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={columnConfig}
        onUpdate={handleColumnUpdate}
        doctype="Item-Wise Sales Report"
        themeColor={themeColor}
      />
    </div>
  );
}

export default ItemWiseSalesReport;