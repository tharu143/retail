import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, ShoppingCart, Receipt, Calendar, User, Layers,
  CheckCircle2, Clock, CreditCard, Palette, Loader2, ChevronLeft, ChevronRight,
  ArrowRight, FileText, Filter, Save, ScanLine, Camera, Package, Eye
} from 'lucide-react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import Swal from 'sweetalert2';
import './Quotation.css';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ListCustomizer from './ListCustomizer';
import { useCustomShortcuts } from '../../hooks/useCustomShortcuts';

/* ==================== UI HELPERS ==================== */
const StatusBadge = ({ status, docstatus }) => {
  const normStatus = (status || (docstatus === 1 ? 'Submitted' : (docstatus === 2 ? 'Cancelled' : 'Draft'))).toLowerCase();

  let bg = '#e2e8f0';
  let color = '#334155';

  if (normStatus === 'draft') {
    bg = '#fef3c7';
    color = '#d97706';
  } else if (normStatus === 'submitted' || normStatus === 'open') {
    bg = '#dcfce7';
    color = '#15803d';
  } else if (normStatus === 'ordered') {
    bg = '#dbeafe';
    color = '#1d4ed8';
  } else if (normStatus === 'lost' || normStatus === 'cancelled') {
    bg = '#fee2e2';
    color = '#991b1b';
  } else if (normStatus === 'expired') {
    bg = '#f3e8ff';
    color = '#7e22ce';
  }

  return (
    <span
      className="so-badge"
      style={{
        backgroundColor: bg,
        color: color,
        fontWeight: 800,
        textTransform: 'uppercase',
        fontSize: '11px',
        padding: '3px 10px',
        borderRadius: '9999px',
        letterSpacing: '0.04em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }}></span>
      {status || (docstatus === 1 ? 'Submitted' : 'Draft')}
    </span>
  );
};

export default function QuotationList() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const { warehouse, user_roles, theme } = useSelector((state) => state.user || {});
  const { themeColor, themeLight, toggleTheme, isGreen } = useLegacyTheme();

  const [activeTab, setActiveTab] = useState('Quotation');
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(location.state?.search || '');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateRange, setFilterDateRange] = useState('');

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [customColumns, setCustomColumns] = useState(() => {
    const saved = localStorage.getItem('custom_columns_Quotation');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_quotations_list', {
        params: {
          search_term: searchTerm || null,
          limit_start: 0,
          limit_page_length: 500
        },
        withCredentials: true
      });
      const data = res.data?.data || res.data?.message?.data || [];
      setQuotations(data);
    } catch (err) {
      console.error('Failed to fetch quotations:', err);
      try {
        const fallbackRes = await axios.get('/api/resource/Quotation', {
          params: {
            fields: '["name","party_name","customer_name","transaction_date","valid_till","grand_total","status","docstatus","currency","company"]',
            order_by: 'creation desc',
            limit_page_length: 500
          },
          withCredentials: true
        });
        setQuotations(fallbackRes.data?.data || []);
      } catch (fallbackErr) {
        setQuotations([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        (q.name && q.name.toLowerCase().includes(term)) ||
        (q.party_name && q.party_name.toLowerCase().includes(term)) ||
        (q.customer_name && q.customer_name.toLowerCase().includes(term));

      const matchStatus = !filterStatus || q.status === filterStatus || (filterStatus === 'Submitted' && q.docstatus === 1) || (filterStatus === 'Draft' && q.docstatus === 0);

      return matchSearch && matchStatus;
    });
  }, [quotations, searchTerm, filterStatus]);

  // Pagination calculations
  const totalRecords = filteredQuotations.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedQuotations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredQuotations.slice(start, start + pageSize);
  }, [filteredQuotations, currentPage, pageSize]);

  // Executive Stats
  const stats = useMemo(() => {
    const total = quotations.length;
    const submitted = quotations.filter((q) => q.docstatus === 1 || q.status === 'Submitted' || q.status === 'Open').length;
    const drafts = quotations.filter((q) => q.docstatus === 0 || q.status === 'Draft').length;
    const totalValue = quotations.reduce((acc, q) => acc + (parseFloat(q.grand_total) || 0), 0);
    return { total, submitted, drafts, totalValue };
  }, [quotations]);

  return (
    <div className="so-container" style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* 1. TOP PILL TABS */}
      <div className="so-top-nav" style={{ padding: '1rem 2rem 0', background: '#f8fafc' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('Quotation')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'Quotation' ? (themeColor || '#0082f6') : '#ffffff',
              color: activeTab === 'Quotation' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'Quotation' ? '0 2px 4px rgba(0, 130, 246, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            Quotation
          </button>
          <button
            type="button"
            onClick={() => navigate('/salesreport')}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              background: '#ffffff',
              color: '#64748b',
              transition: 'all 0.15s ease'
            }}
          >
            Reports
          </button>
        </div>
      </div>

      {/* 2. HEADER CARD */}
      <div style={{ padding: '1rem 2rem 0 2rem', background: '#f8fafc' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: `${themeColor || '#0082f6'}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: themeColor || '#0082f6'
              }}
            >
              <FileText size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                QUOTATION MANAGEMENT
              </h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0', fontWeight: 500 }}>
                Manage, print, and convert customer sales quotations
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 16px',
                background: '#ffffff',
                color: themeColor || '#0082f6',
                border: `1.5px solid ${themeColor || '#0082f6'}`,
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease-in-out'
              }}
            >
              <Palette size={14} />
              <span>THEME: LEGACY</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 16px',
                background: '#ffffff',
                color: themeColor || '#0082f6',
                border: `1.5px solid ${themeColor || '#0082f6'}`,
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease-in-out'
              }}
            >
              <Palette size={14} />
              <span>{isGreen ? 'BLUE' : 'GREEN'}</span>
            </button>

            <ListCustomizer
              doctype="Quotation"
              onSave={(cols) => setCustomColumns(cols)}
              themeColor={themeColor || '#0082f6'}
              btnStyle={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 16px',
                background: '#ffffff',
                color: themeColor || '#0082f6',
                border: `1.5px solid ${themeColor || '#0082f6'}`,
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease-in-out'
              }}
            />

            <button
              type="button"
              onClick={() => navigate('/quotation/create')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 16px',
                background: themeColor || '#0082f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: `0 2px 4px ${themeColor || '#0082f6'}40`,
                transition: 'all 0.15s ease-in-out'
              }}
            >
              <Plus size={16} />
              <span>CREATE QUOTATION</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. LAYOUT / FILTERS / EXECUTIVE STATS */}
      <div className="so-layout" style={{ background: '#f8fafc', padding: '1.25rem 2rem' }}>
        {/* Search Order Matrix */}
        <div
          className="so-filter-bar"
          style={{
            background: '#f8fafc',
            padding: '0 0 1.25rem 0',
            border: 'none',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '1.25rem',
            marginBottom: '0.25rem',
            boxShadow: 'none'
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
              Search Order Matrix
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 2 }} />
              <input
                className="so-filter-input so-filter-input-icon"
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by Order ID or Customer..."
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#fff',
                  paddingLeft: '2.5rem'
                }}
              />
            </div>
          </div>
          <div>
            <button
              type="button"
              className="so-clear-btn"
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('');
                setFilterDateRange('');
              }}
              style={{
                height: '38px',
                padding: '0 1.25rem',
                borderRadius: '8px',
                background: '#ffffff',
                color: searchTerm || filterStatus || filterDateRange ? '#ef4444' : '#64748b',
                border: `1px solid ${searchTerm || filterStatus || filterDateRange ? '#fecaca' : '#cbd5e1'}`,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              {searchTerm || filterStatus || filterDateRange ? <X size={14} /> : null}
              <span>Clear Search</span>
            </button>
          </div>
        </div>

        {/* Executive Dashboard (Summary Bar - 4 Cards) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '1.25rem 2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ borderRight: '1px solid #f1f5f9', paddingRight: '1.5rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL ORDERS</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: themeColor || '#0082f6', marginTop: '4px' }}>{stats.total}</div>
          </div>

          <div style={{ borderRight: '1px solid #f1f5f9', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SUBMITTED</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>{stats.submitted}</div>
          </div>

          <div style={{ borderRight: '1px solid #f1f5f9', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>DRAFTS</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b', marginTop: '4px' }}>{stats.drafts}</div>
          </div>

          <div style={{ paddingLeft: '1.5rem' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL AMOUNT</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DirhamIcon size={16} />
              <span>{stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Main Directory Table */}
        <div className="so-content" style={{ padding: 0 }}>
          <div className="so-list-meta" style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#64748b', fontSize: '13px' }}>
            {filteredQuotations.length} record(s) found
          </div>

          <div className="so-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="so-table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="so-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '14px 16px' }}>ORDER ID</th>
                    <th style={{ padding: '14px 16px' }}>CUSTOMER</th>
                    <th style={{ padding: '14px 16px' }}>DATE</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right' }}>GRAND TOTAL</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center' }}>DETAILS</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '13px', color: '#1e293b' }}>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <Loader2 className="animate-spin" size={18} color={themeColor || '#0082f6'} />
                          <span>Loading Quotations...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedQuotations.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                        <FileText size={36} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#64748b' }}>No Quotations Found</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Create a new quotation to get started</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedQuotations.map((q) => (
                      <tr
                        key={q.name}
                        onClick={() => navigate(`/quotation-details/${encodeURIComponent(q.name)}`)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                      >
                        {/* ORDER ID */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: `${themeColor || '#0082f6'}10`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: themeColor || '#0082f6'
                              }}
                            >
                              <ShoppingCart size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: themeColor || '#0082f6' }}>{q.name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>SAL-QTN-.YYYY.-</div>
                            </div>
                          </div>
                        </td>

                        {/* CUSTOMER */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#334155' }}>
                            <User size={13} color="#94a3b8" />
                            <span>{q.customer_name || q.party_name || 'Cash'}</span>
                          </div>
                        </td>

                        {/* DATE */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px', fontWeight: 600 }}>
                            <Calendar size={13} color="#94a3b8" />
                            <span>{q.transaction_date || '-'}</span>
                          </div>
                        </td>

                        {/* GRAND TOTAL */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                            <DirhamIcon size={13} />
                            <span>{parseFloat(q.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <StatusBadge status={q.status} docstatus={q.docstatus} />
                        </td>

                        {/* DETAILS ARROW */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/quotation-details/${encodeURIComponent(q.name)}`);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: themeColor || '#0082f6',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            <ArrowRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div
              className="so-pagination"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
                fontSize: '13px',
                color: '#64748b'
              }}
            >
              <div>
                Showing <span style={{ fontWeight: 800, color: '#0f172a' }}>{paginatedQuotations.length}</span> of{' '}
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{totalRecords}</span> records
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>PAGE CAPACITY:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      height: '32px',
                      padding: '0 8px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      background: '#fff',
                      color: currentPage === 1 ? '#cbd5e1' : '#334155',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span
                    style={{
                      height: '32px',
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      background: '#fff',
                      fontSize: '12px',
                      fontWeight: 800,
                      color: themeColor || '#0082f6'
                    }}
                  >
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      background: '#fff',
                      color: currentPage === totalPages ? '#cbd5e1' : '#334155',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
