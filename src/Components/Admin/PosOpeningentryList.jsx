// src/pages/PosOpeningentryList.jsx
import React, { useState, useEffect } from 'react';
import {
  Plus, Calendar, Store, Building, Clock, Search,
  ChevronLeft, ChevronRight, Palette, Loader2, Layers, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Admin/SalesOrder.css';

function PosOpeningentryList() {
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterPosProfile, setFilterPosProfile] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  const navigate = useNavigate();
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
  const getSession = () => localStorage.getItem('session') || '';

  // Theme support (synced)
  const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = polTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', polTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [polTheme, themeColor, themeColorHover, themeLight]);

  const fetchOpenings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page_length: pageSize,
        page_start: (currentPage - 1) * pageSize
      });

      if (filterPosProfile) params.append('pos_profile', filterPosProfile);
      if (filterCompany) params.append('company', filterCompany);

      const res = await fetch(`${API_PATH}.get_opening_entries?${params}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });

      const data = await res.json();
      if (data.message?.status === 'success') {
        const list = data.message.data || [];
        setOpenings(list);
        setTotal(list.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenings();
  }, [currentPage, pageSize, filterPosProfile, filterCompany]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <div className="so-page">
        {/* 1. Page Header (Matching CustomerList exactly) */}
        <div className="so-page-header" style={{ padding: '1.25rem 2rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Layers size={22} style={{ color: themeColor }} />
              <span style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>SHIFT OPENING ENTRIES</span>
            </h1>
            <p className="so-page-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>{total} shift record(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                height: '38px', padding: '0 1rem', background: '#ffffff',
                border: `1.5px solid ${themeColor}`, borderRadius: '8px',
                fontSize: '12px', fontWeight: 800, color: themeColor,
                cursor: 'pointer', transition: 'all 0.15s ease-in-out',
                textTransform: 'uppercase', letterSpacing: '0.04em', boxSizing: 'border-box'
              }}
            >
              <Palette size={14} /> {polTheme.toUpperCase()}
            </button>
            <button
              className="so-btn-primary"
              onClick={fetchOpenings}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                height: '38px', padding: '0 1rem', background: themeColor,
                color: '#ffffff', border: 'none', borderRadius: '8px',
                fontSize: '12px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.15s ease-in-out',
                boxSizing: 'border-box'
              }}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> REFRESH
            </button>
          </div>
        </div>

        {/* 2. Layout Wrap (Direct Port of CustomerList Structure) */}
        <div className="so-layout" style={{ flexDirection: 'column', background: '#f8fafc', padding: '1.5rem 2rem' }}>

          {/* Top Filter Bar (Transparent, Aligned with Content Card) */}
          <div className="so-filter-bar" style={{
            padding: '0 0 1.25rem 0',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.25rem',
            alignItems: 'flex-end',
            marginBottom: '0.5rem'
          }}>
            <div style={{ flex: '1 1 300px' }}>
              <label className="so-filter-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>SEARCH POS PROFILE</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 2 }} />
                <input
                  type="text"
                  placeholder="Name of profile..."
                  value={filterPosProfile}
                  onChange={e => setFilterPosProfile(e.target.value)}
                  className="so-filter-input"
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', paddingLeft: '2.25rem' }}
                />
              </div>
            </div>

            <div style={{ flex: '1 1 200px' }}>
              <label className="so-filter-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>COMPANY SEARCH</label>
              <input
                type="text"
                placeholder="Branch name..."
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                className="so-filter-input"
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', padding: '0 0.75rem' }}
              />
            </div>

            <button
              onClick={() => { setFilterPosProfile(''); setFilterCompany(''); setCurrentPage(1); }}
              className="so-clear-btn"
              style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, color: '#64748b', background: '#ffffff', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              CLEAR FILTERS
            </button>
          </div>

          {/* Main Content Area */}
          <div className="so-content" style={{ padding: 0, flex: 1, background: 'transparent' }}>
            <p className="so-list-meta" style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#64748b', fontSize: '13px' }}>{total} record(s) found</p>

            <div className="so-table-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
              <div className="so-table-wrapper">
                <table className="so-table">
                  <thead>
                    <tr>
                      <th className="w-12 px-6 py-3"><input type="checkbox" /></th>
                      <th>LOG ID</th>
                      <th>SHIFT TIMELINE</th>
                      <th>POS PROFILE</th>
                      <th>COMPANY</th>
                      <th className="text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="6" className="so-empty">
                        <Loader2 size={24} className="so-spinner" style={{ margin: '0 auto' }} />
                      </td></tr>
                    ) : openings.length === 0 ? (
                      <tr><td colSpan="6" className="so-empty">No shift logs found</td></tr>
                    ) : (
                      openings.map(entry => (
                        <tr key={entry.name} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/pos-opening/${entry.name}`)}>
                          <td className="px-6 py-4" onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                          <td className="font-semibold" style={{ color: themeColor }}>{entry.name}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem' }}>
                                {new Date(entry.period_start_date).toLocaleString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric'
                                })}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>
                                {new Date(entry.period_start_date).toLocaleTimeString('en-IN', {
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </td>
                          <td className="font-bold text-slate-700">{entry.pos_profile}</td>
                          <td>{entry.company}</td>
                          <td className="text-center">
                            <span style={{
                              fontSize: '0.65rem', padding: '0.2rem 0.75rem', borderRadius: '1rem', fontWeight: 800, textTransform: 'uppercase',
                              background: (entry.status || '').toLowerCase() === 'open' ? 'var(--so-primary-light)' : '#f1f5f9',
                              color: (entry.status || '').toLowerCase() === 'open' ? 'var(--so-primary)' : '#94a3b8'
                            }}>
                              {entry.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && total > 0 && (
                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                    Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total} Members
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                      {[20, 50, 100].map(size => (
                        <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }} className={`so-page-btn ${pageSize === size ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{size}</button>
                      ))}
                    </div>

                    <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                      <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages}</span>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))} disabled={currentPage === totalPages}><ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default PosOpeningentryList;