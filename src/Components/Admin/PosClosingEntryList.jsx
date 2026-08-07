import React, { useState, useEffect } from 'react';
import { 
    Plus, Calendar, User, DollarSign, Package, Search, Filter, 
    ChevronLeft, ChevronRight, Palette, Receipt, Clock, Tag, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './SalesOrder.css';
import { useSelector } from 'react-redux';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

function PosClosingEntryList() {
  const { warehouse } = useSelector(state => state.user || {});
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    pos_profile: '',
    user: '',
    status: ''
  });

  const navigate = useNavigate();
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
  const getSession = () => localStorage.getItem('session') || '';

  // Theme support
  const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = polTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#ecfdf5' : '#f0f9ff';
  const themeHeaderBg = isGreen ? '#f2fdf9' : '#eff6ff';
  const themeHeaderText = isGreen ? '#0d9488' : '#1d4ed8';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', polTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [polTheme, themeColor, themeColorHover, themeLight]);

  /* ────────────────────── FETCH CLOSINGS ────────────────────── */
  useEffect(() => {
    fetchClosings();
  }, [currentPage, pageSize, filters, warehouse]);

  const fetchClosings = async () => {
    try {
      setLoading(true);
      const queryObj = {
        page_length: pageSize,
        page_start: (currentPage - 1) * pageSize,
        filters: JSON.stringify(filters)
      };
      if (warehouse) queryObj.warehouse = warehouse;

      const params = new URLSearchParams(queryObj);

      const res = await fetch(`${API_PATH}.get_closing_entries?${params}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });

      const data = await res.json();
      if (data.message?.success) {
        setClosings(data.message.data);
        setTotal(data.message.total);
      } else {
        alert(data.message?.message || 'Failed to load');
      }
    } catch (err) {
      alert('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────── PAGINATION ────────────────────── */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="so-page">

      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <Receipt size={22} />
            POS Closing Entries
          </h1>
          <p className="so-page-subtitle">Historical record of shift settlements and reconciliations</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem', background: themeHeaderBg,
              border: `1.5px solid ${themeColor}`, borderRadius: '0.5rem',
              fontSize: '0.7rem', fontWeight: 700, color: themeHeaderText,
              cursor: 'pointer', transition: 'all 0.2s',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}
          >
            <Palette size={14} />
            {polTheme}
          </button>

          <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>

          <button className="so-btn-primary" onClick={() => navigate('/closingentry')}>
            <Plus size={16} /> New Closing Entry
          </button>
        </div>
      </div>

      {/* 2. HORIZONTAL FILTER BAR */}
      <div className="so-filter-bar">
        <div style={{ flex: '1 1 150px' }}>
          <label className="so-filter-label">From Date</label>
          <input
            type="date"
            className="so-filter-input"
            value={filters.from_date}
            onChange={e => { setFilters({ ...filters, from_date: e.target.value }); setCurrentPage(1); }}
          />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label className="so-filter-label">To Date</label>
          <input
            type="date"
            className="so-filter-input"
            value={filters.to_date}
            onChange={e => { setFilters({ ...filters, to_date: e.target.value }); setCurrentPage(1); }}
          />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label className="so-filter-label">POS Profile</label>
          <input
            type="text"
            className="so-filter-input"
            placeholder="Filter profile..."
            value={filters.pos_profile}
            onChange={e => { setFilters({ ...filters, pos_profile: e.target.value }); setCurrentPage(1); }}
          />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label className="so-filter-label">User</label>
          <input
            type="text"
            className="so-filter-input"
            placeholder="Filter user ID..."
            value={filters.user}
            onChange={e => { setFilters({ ...filters, user: e.target.value }); setCurrentPage(1); }}
          />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label className="so-filter-label">Status</label>
          <select
            className="so-filter-select"
            value={filters.status}
            onChange={e => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(1); }}
          >
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
          </select>
        </div>
        <button 
          className="so-clear-btn" 
          onClick={() => setFilters({ from_date: '', to_date: '', pos_profile: '', user: '', status: '' })}
          style={{ width: 'auto', margin: 0, padding: '0 1rem', height: '38px' }}
        >
          Clear
        </button>
      </div>

      {/* 3. MAIN CONTENT */}
      <main className="so-content" style={{ padding: '1.5rem 2rem' }}>
        <p className="so-list-meta">
          Showing <b>{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)}</b> of <b>{total}</b> settlements
        </p>

        <div className="so-table-card">
          <div className="so-table-wrapper">
            <table className="so-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift Information</th>
                  <th>Closing Agent</th>
                  <th style={{ textAlign: 'right' }}>Items</th>
                  <th style={{ textAlign: 'right' }}>Net Summary</th>
                  <th style={{ textAlign: 'right' }}>Grand Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="so-empty">
                      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                      <p style={{ marginTop: '0.5rem' }}>Loading settlements...</p>
                    </td>
                  </tr>
                ) : closings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="so-empty">No closing entries match your filters.</td>
                  </tr>
                ) : (
                  closings.map(c => (
                    <tr key={c.name} onClick={() => navigate(`/pos-closing/${c.name}`)}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.posting_date}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={14} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{c.pos_profile}</span>
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
                          {c.period_start} — {c.period_end}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={14} style={{ color: '#64748b' }} />
                          <span style={{ fontSize: '0.75rem' }}>{c.user}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                         <span style={{ fontWeight: 600 }}>{c.total_quantity}</span>
                         <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '4px' }}>pcs</span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%' }}>
                          <DirhamIcon size={12} />
                          <span>{c.net_total.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', width: '100%', fontWeight: 800, color: themeColor, fontSize: '0.85rem' }}>
                          <DirhamIcon size={12} />
                          <span>{c.grand_total.toLocaleString('en-AE', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td>
                        <span className="so-badge" style={{
                            background: c.status === 'Submitted' ? '#dcfce7' : c.status === 'Draft' ? '#fef9c3' : '#fee2e2',
                            color: c.status === 'Submitted' ? '#166534' : c.status === 'Draft' ? '#854d0e' : '#991b1b'
                        }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="so-pagination">
          <div style={{ color: '#64748b' }}>
            Page <b>{currentPage}</b> of <b>{totalPages}</b>
          </div>
          <div className="so-pagination-btns">
            <button
              className="so-page-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={14} />
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const pageNum = i + 1;
                return (
                    <button
                        key={pageNum}
                        className={`so-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                    >
                        {pageNum}
                    </button>
                );
            })}
            <button
              className="so-page-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight size={14} />
            </button>

            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ padding: '0.2rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.7rem', marginLeft: '0.5rem' }}
            >
              {[10, 20, 50].map(sz => <option key={sz} value={sz}>{sz} / page</option>)}
            </select>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PosClosingEntryList;