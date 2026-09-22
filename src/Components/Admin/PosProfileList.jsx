import PageHeader from '../UI/PageHeader';
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Building, Warehouse, Users, CreditCard,
  ChevronLeft, ChevronRight, Search, Filter,
  Palette, Loader2
} from 'lucide-react';
import './SalesOrder.css';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const getSession = () => localStorage.getItem('session') || '';

export default function PosProfileList() {
  const { user, user_roles } = useSelector(state => state.user || {});
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companiesList, setCompaniesList] = useState([]);

  // Theme support
  const [polTheme, setPolTheme] = useState(localStorage.getItem('legacySubTheme') || 'blue');
  const isGreen = polTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0082f6';
  const themeColorHover = isGreen ? '#059669' : '#006cd4';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', polTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [polTheme, themeColor, themeColorHover, themeLight]);

  /* ────────────────────── FETCH PROFILES ────────────────────── */
  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_PATH}.get_pos_profiles`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.message?.success) {
        const list = data.message.data || [];
        setProfiles(list);
        setFilteredProfiles(list);
        setTotal(list.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch(`${API_PATH}.get_companies`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      const data = await res.json();
      const list = data.message?.data || data.message || [];
      if (Array.isArray(list)) setCompaniesList(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchCompanies();
  }, []);

  /* ────────────────────── FILTERING ────────────────────── */
  useEffect(() => {
    let filtered = profiles;

    const isSuperAdmin = user?.toLowerCase() === 'administrator';
    if (!isSuperAdmin && user) {
      filtered = filtered.filter(p =>
        (p.users || []).some(u => u.user?.toLowerCase() === user.toLowerCase())
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.company?.toLowerCase().includes(term)
      );
    }
    if (companyFilter) filtered = filtered.filter(p => p.company === companyFilter);
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => (p.disabled ? 'disabled' : 'enabled') === statusFilter);
    }

    setFilteredProfiles(filtered);
    setTotal(filtered.length);
    setCurrentPage(1);
  }, [searchTerm, companyFilter, statusFilter, profiles, user]);

  /* ────────────────────── PAGINATION ────────────────────── */
  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / pageSize));
  const paginated = filteredProfiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="erp-page so-page">

      {/* 1. HEADER */}
      <PageHeader className="so-page-header" style={{ padding: '1.25rem 2rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <CreditCard size={22} style={{ color: themeColor }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>POS PROFILES</span>
          </h1>
          <p className="so-page-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Configure store registers, payment methods & user access</p>
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
            className="erp-button erp-button-primary so-btn-primary"
            onClick={() => navigate('/pos-profile/new')}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              height: '38px', padding: '0 1rem', background: themeColor,
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '12px', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.15s ease-in-out',
              boxSizing: 'border-box'
            }}
          >
            <Plus size={16} /> CREATE PROFILE
          </button>
        </div>
      </PageHeader>

      {/* 2. LAYOUT & FILTER BAR */}
      <div className="so-layout" style={{ flexDirection: 'column', background: '#f8fafc', padding: '1.5rem 2rem' }}>

        <div className="erp-filter-bar so-filter-bar" style={{ padding: '0 0 1.25rem 0', background: 'transparent', border: 'none', boxShadow: 'none', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
          <div style={{ flex: '1 1 250px' }}>
            <label className="so-filter-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>SEARCH PROFILE</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 2 }} />
              <input
                type="text"
                placeholder="Name or company..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="so-filter-input"
                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          <div style={{ flex: '0 0 200px' }}>
            <label className="so-filter-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>COMPANY</label>
            <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} className="so-filter-input" style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', padding: '0 0.75rem' }}>
              <option value="">ALL COMPANIES</option>
              {companiesList.map(c => <option key={c.name || c} value={c.name || c}>{c.name || c}</option>)}
            </select>
          </div>

          <div style={{ flex: '0 0 150px' }}>
            <label className="so-filter-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>STATUS</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="so-filter-input" style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', padding: '0 0.75rem' }}>
              <option value="all">ALL STATUS</option>
              <option value="enabled">ENABLED</option>
              <option value="disabled">DISABLED</option>
            </select>
          </div>

          <button
            onClick={() => { setSearchTerm(''); setCompanyFilter(''); setStatusFilter('all'); }}
            className="so-clear-btn"
            style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, color: '#64748b', background: '#ffffff', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            RESET
          </button>
        </div>

        {/* 3. TABLE */}
        <div className="so-content" style={{ padding: 0, flex: 1, background: 'transparent' }}>
          <p className="so-list-meta" style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#64748b', fontSize: '13px' }}>{filteredProfiles.length} record(s) found</p>

          <div className="erp-table-card so-table-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <div className="erp-table-scroll so-table-wrapper">
              <table className="erp-table so-table">
                <thead>
                  <tr>
                    <th className="w-12"><input type="checkbox" className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer" style={{ verticalAlign: 'middle' }} /></th>
                    <th>PROFILE NAME</th>
                    <th>COMPANY</th>
                    <th>BRANCH</th>
                    <th>USERS</th>
                    <th className="text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" className="erp-empty so-empty">
                      <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: themeColor }} />
                    </td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan="6" className="erp-empty so-empty">No POS profiles found</td></tr>
                  ) : (
                    paginated.map(p => (
                      <tr 
                        key={p.name} 
                        className="cursor-pointer hover:bg-slate-50" 
                        onClick={() => navigate(`/pos-profile/${encodeURIComponent(p.name)}`)}
                      >
                        <td className="w-12" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer" style={{ verticalAlign: 'middle' }} />
                        </td>
                        <td className="font-semibold" style={{ color: themeColor }}>{p.name}</td>
                        <td>{p.company}</td>
                        <td>{p.warehouse}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {p.users?.slice(0, 3).map(u => (
                              <span key={u.user} style={{
                                fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '1rem',
                                background: u.default ? themeLight : '#f1f5f9',
                                color: u.default ? themeColor : '#64748b',
                                fontWeight: 700
                              }}>
                                {u.user?.split('@')[0]}
                              </span>
                            ))}
                            {p.users?.length > 3 && <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>+{p.users.length - 3}</span>}
                          </div>
                        </td>
                        <td className="text-center">
                          <span style={{
                            fontSize: '0.65rem', padding: '0.2rem 0.75rem', borderRadius: '1rem', fontWeight: 800, textTransform: 'uppercase',
                            background: p.disabled ? '#fee2e2' : themeLight,
                            color: p.disabled ? '#ef4444' : themeColor
                          }}>
                            {p.disabled ? 'Disabled' : 'Enabled'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredProfiles.length > 0 && (
              <div className="erp-pagination so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                  Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredProfiles.length)} of {filteredProfiles.length}
                </span>

                <div className="so-pagination-btns" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{ fontWeight: 700, color: themeColor, padding: '0 0.5rem', fontSize: '0.75rem' }}>
                    {currentPage} / {totalPages}
                  </span>
                  <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}