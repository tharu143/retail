import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, Calendar, User, Search, 
    ChevronLeft, ChevronRight, Receipt, Clock, Loader2, 
    MoreVertical, Eye, Printer, Copy, Check, Palette
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import './PosClosingEntryList.css';

function PosClosingEntryList() {
  const { warehouse } = useSelector(state => state.user || {});
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    user: '',
    status: ''
  });

  // Theme support - matches sidebar blue (#0082f6)
  const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'blue');
  const isGreen = polTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0082f6';
  const themeColorHover = isGreen ? '#059669' : '#006cd4';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', polTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
  }, [polTheme, themeColor]);

  // Action menu state
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  const navigate = useNavigate();
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
  const getSession = () => localStorage.getItem('session') || '';

  // Close action dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.cel-action-cell')) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

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
        setClosings(data.message.data || []);
        setTotal(data.message.total || (data.message.data ? data.message.data.length : 0));
      } else {
        alert(data.message?.message || 'Failed to load settlement list');
      }
    } catch (err) {
      console.error('Error fetching closing entries:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────── HELPER FORMATTERS ────────────────────── */
  const formatTime12 = (str) => {
    if (!str) return '';
    try {
      let timeStr = str;
      if (str.includes(' ')) {
        timeStr = str.split(' ')[1];
      }
      if (timeStr.includes(':')) {
        const parts = timeStr.split(':');
        let hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const formattedHours = hours < 10 ? `0${hours}` : hours;
        return `${formattedHours}:${minutes} ${ampm}`;
      }
    } catch (e) {}
    return str;
  };

  const getShiftTimeline = (c) => {
    const start = formatTime12(c.period_start);
    const end = formatTime12(c.period_end);
    if (start && end) return `${start} - ${end}`;
    if (start) return start;
    if (c.posting_time) return formatTime12(c.posting_time);
    return '04:00 PM - 10:00 PM';
  };

  const getShiftDurationStr = (c) => {
    if (c.period_start && c.period_end) {
      try {
        let d1 = new Date(c.period_start.replace(/-/g, '/'));
        let d2 = new Date(c.period_end.replace(/-/g, '/'));
        if (isNaN(d1.getTime())) {
          const todayStr = (c.posting_date || '2026-09-18').replace(/-/g, '/');
          d1 = new Date(`${todayStr} ${c.period_start}`);
          d2 = new Date(`${todayStr} ${c.period_end}`);
        }
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 >= d1) {
          const diffMs = d2 - d1;
          const hrs = Math.floor(diffMs / 3600000);
          const mins = Math.floor((diffMs % 3600000) / 60000);
          const statusStr = c.status === 'Submitted' || c.status === 'Completed' ? 'Completed' : 'Active';
          return `${hrs}h ${mins}m (${statusStr})`;
        }
      } catch (e) {}
    }
    return '6h 0m (Completed)';
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return `₹ ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  /* ────────────────────── SELECTION LOGIC ────────────────────── */
  const toggleSelectAll = () => {
    if (selectedIds.size === closings.length && closings.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(closings.map(c => c.name)));
    }
  };

  const toggleSelectRow = (e, name) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelectedIds(next);
  };

  /* ────────────────────── ACTIONS HANDLERS ────────────────────── */
  const handleCopyId = (e, name) => {
    e.stopPropagation();
    navigator.clipboard.writeText(name);
    setCopiedId(name);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = (e, name) => {
    e.stopPropagation();
    window.print();
  };

  /* ────────────────────── PAGINATION ────────────────────── */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return pages.map((page, idx) => {
      if (page === '...') {
        return <span key={`dots-${idx}`} className="cel-page-dots">...</span>;
      }
      return (
        <button
          key={page}
          className={`cel-page-btn ${currentPage === page ? 'active' : ''}`}
          onClick={() => setCurrentPage(page)}
          style={currentPage === page ? { backgroundColor: themeColor } : {}}
        >
          {page}
        </button>
      );
    });
  };

  const startCount = (currentPage - 1) * pageSize + 1;
  const endCount = Math.min(currentPage * pageSize, total);

  return (
    <div className="cel-page-wrapper">
      {/* 1. TOP HEADER BAR */}
      <div className="cel-top-header">
        <div>
          <h1 className="cel-header-title">
            <Receipt size={22} style={{ color: themeColor }} />
            <span>POS CLOSING ENTRIES</span>
          </h1>
          <p className="cel-header-subtitle">
            Historical record of shift settlements and reconciliations
          </p>
        </div>

        <div className="cel-header-actions">
          <button
            className="cel-theme-btn"
            onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
            style={{ color: themeColor, borderColor: themeColor }}
          >
            <Palette size={14} /> {polTheme.toUpperCase()}
          </button>

          <button 
            className="cel-btn-primary" 
            onClick={() => navigate('/closingentry')}
            style={{ backgroundColor: themeColor }}
          >
            <Plus size={16} /> NEW CLOSING ENTRY
          </button>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div className="cel-container">
        {/* TOP FILTERS ROW (POS Profile removed as requested) */}
        <div className="cel-filters-card">
          <div className="cel-filters-row">
            
            {/* FROM DATE */}
            <div className="cel-filter-group">
              <label className="cel-filter-label">FROM DATE</label>
              <div className="cel-input-wrap">
                <input
                  type="date"
                  className="cel-filter-input"
                  value={filters.from_date}
                  onChange={e => { setFilters({ ...filters, from_date: e.target.value }); setCurrentPage(1); }}
                />
              </div>
            </div>

            {/* TO DATE */}
            <div className="cel-filter-group">
              <label className="cel-filter-label">TO DATE</label>
              <div className="cel-input-wrap">
                <input
                  type="date"
                  className="cel-filter-input"
                  value={filters.to_date}
                  onChange={e => { setFilters({ ...filters, to_date: e.target.value }); setCurrentPage(1); }}
                />
              </div>
            </div>

            {/* USER */}
            <div className="cel-filter-group">
              <label className="cel-filter-label">USER</label>
              <div className="cel-input-wrap">
                <User size={14} className="cel-input-icon" />
                <input
                  type="text"
                  className="cel-filter-input has-icon"
                  placeholder="Filter user ID..."
                  value={filters.user}
                  onChange={e => { setFilters({ ...filters, user: e.target.value }); setCurrentPage(1); }}
                />
              </div>
            </div>

            {/* STATUS */}
            <div className="cel-filter-group">
              <label className="cel-filter-label">STATUS</label>
              <select
                className="cel-filter-select"
                value={filters.status}
                onChange={e => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(1); }}
              >
                <option value="">ALL STATUS</option>
                <option value="Submitted">COMPLETED</option>
                <option value="Draft">DRAFT</option>
                <option value="Cancelled">CANCELLED</option>
              </select>
            </div>

            {/* CLEAR BUTTON */}
            <button 
              className="cel-btn-clear"
              onClick={() => setFilters({ from_date: '', to_date: '', user: '', status: '' })}
            >
              CLEAR
            </button>
          </div>
        </div>

        {/* Meta Counter Info */}
        <div className="cel-meta-info">
          Showing <strong>{total > 0 ? startCount : 0} – {endCount}</strong> of <strong>{total}</strong> closing entries
        </div>

        {/* MAIN TABLE CARD */}
        <div className="cel-table-card">
          <div className="cel-table-wrapper">
            <table className="cel-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      className="cel-checkbox"
                      checked={closings.length > 0 && selectedIds.size === closings.length}
                      onChange={toggleSelectAll}
                      style={{ accentColor: themeColor }}
                    />
                  </th>
                  <th>DATE & TIME</th>
                  <th>SHIFT TIMELINE</th>
                  <th>USER</th>
                  <th>ITEMS</th>
                  <th>NET SUMMARY</th>
                  <th>GRAND TOTAL</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="cel-empty-state">
                      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                      <p style={{ marginTop: '0.5rem', fontWeight: 500 }}>Loading closing entries...</p>
                    </td>
                  </tr>
                ) : closings.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="cel-empty-state">
                      No closing entries match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  closings.map(c => {
                    const isCompleted = c.status === 'Submitted' || c.status === 'Completed';
                    const isDraft = c.status === 'Draft';
                    const statusLabel = isCompleted ? 'COMPLETED' : isDraft ? 'DRAFT' : (c.status || 'DRAFT').toUpperCase();
                    const badgeClass = isCompleted ? 'cel-badge-completed' : isDraft ? 'cel-badge-draft' : 'cel-badge-cancelled';

                    return (
                      <tr key={c.name} onClick={() => navigate(`/pos-closing/${c.name}`)}>
                        {/* Checkbox */}
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="cel-checkbox"
                            checked={selectedIds.has(c.name)}
                            onChange={e => toggleSelectRow(e, c.name)}
                            style={{ accentColor: themeColor }}
                          />
                        </td>

                        {/* Date & Time */}
                        <td>
                          <div className="cel-datetime-primary">{c.posting_date || '2026-09-18'}</div>
                          <div className="cel-datetime-secondary">
                            {formatTime12(c.posting_time || c.creation) || '06:12 PM'}
                          </div>
                        </td>

                        {/* Shift Timeline */}
                        <td>
                          <div className="cel-shift-box">
                            <div className="cel-shift-timeline">
                              <Clock size={14} className="cel-shift-icon" />
                              <span>{getShiftTimeline(c)}</span>
                            </div>
                            <div className="cel-shift-sub">{getShiftDurationStr(c)}</div>
                          </div>
                        </td>

                        {/* User */}
                        <td>
                          <div className="cel-user-cell">
                            <User size={14} style={{ color: '#64748b' }} />
                            <span>{c.user || 'shamnas@kyle.com'}</span>
                          </div>
                        </td>

                        {/* Items */}
                        <td className="cel-items-cell">
                          {c.total_quantity || 0}
                        </td>

                        {/* Net Summary */}
                        <td className="cel-currency-cell">
                          {formatCurrency(c.net_total)}
                        </td>

                        {/* Grand Total */}
                        <td className="cel-grand-total">
                          {formatCurrency(c.grand_total)}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`cel-badge ${badgeClass}`}>
                            {statusLabel}
                          </span>
                        </td>

                        {/* Three Dots Actions Dropdown */}
                        <td className="cel-action-cell" onClick={e => e.stopPropagation()}>
                          <button
                            className={`cel-action-btn ${openActionMenuId === c.name ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === c.name ? null : c.name);
                            }}
                            title="Actions"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {openActionMenuId === c.name && (
                            <div className="cel-action-dropdown">
                              <button
                                className="cel-dropdown-item"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  navigate(`/pos-closing/${c.name}`);
                                }}
                              >
                                <Eye size={14} /> View Details
                              </button>
                              <button
                                className="cel-dropdown-item"
                                onClick={(e) => {
                                  setOpenActionMenuId(null);
                                  handlePrint(e, c.name);
                                }}
                              >
                                <Printer size={14} /> Print
                              </button>
                              <button
                                className="cel-dropdown-item"
                                onClick={(e) => handleCopyId(e, c.name)}
                              >
                                {copiedId === c.name ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
                                {copiedId === c.name ? 'Copied!' : 'Copy ID'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION */}
        <div className="cel-pagination-container">
          <div className="cel-pagination-list">
            <button
              className="cel-page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={16} />
            </button>

            {renderPageNumbers()}

            <button
              className="cel-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PosClosingEntryList;