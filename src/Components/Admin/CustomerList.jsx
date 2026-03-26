// src/pages/CustomerList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft, Palette, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../Admin/SalesOrder.css';

function CustomerList() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterName, setFilterName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    mobile_no: '',
    email_id: ''
  });
  const [saving, setSaving] = useState(false);

  // Theme toggle (synced across pages)
  const [clTheme, setClTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = clTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', clTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [clTheme, themeColor, themeColorHover, themeLight]);

  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
  const getSession = () => localStorage.getItem('session') || '';

  /* ────────────────────── FETCH CUSTOMERS ────────────────────── */
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_PATH}.get_customers_list?order_by=modified desc`, {
          headers: { 'X-Frappe-SID': getSession() },
          credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCustomers((data.message?.data || []).map(c => ({
          value: c.value,
          label: c.label,
          mobile: c.mobile,
          email: c.email
        })));
      } catch (err) {
        alert('Failed to load customers. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  /* ────────────────────── FILTER & PAGINATION ────────────────────── */
  const filtered = useMemo(() => {
    return customers.filter(c =>
      !filterName || c.label.toLowerCase().includes(filterName.toLowerCase())
    );
  }, [customers, filterName]);

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      <div className="so-page">
        {/* Page Header */}
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <Users size={20} /> Customers
            </h1>
            <p className="so-page-subtitle">{total} customer(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setClTheme(isGreen ? 'blue' : 'green')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem', background: '#f8fafc',
                border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}
              title="Toggle Theme"
            >
              <Palette size={13} />
              {clTheme.toUpperCase()}
            </button>
            <button className="so-btn-primary" onClick={() => navigate('/customer-details/new')}>
              <Plus size={16} /> Add Customer
            </button>
          </div>
        </div>

        <div className="so-layout" style={{ flexDirection: 'column' }}>
          <div className="so-filter-bar" style={{
            background: 'white',
            padding: '1.25rem 2rem',
            borderBottom: '1px solid var(--so-border)',
            display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end'
          }}>
            <div style={{ flex: '1 1 300px' }}>
              <label className="so-filter-label">Search by Name</label>
              <input
                className="so-filter-input"
                type="text"
                value={filterName}
                onChange={e => { setFilterName(e.target.value); setCurrentPage(1); }}
                placeholder="Search customers..."
              />
            </div>
            <button
              className="so-clear-btn"
              onClick={() => { setFilterName(''); setCurrentPage(1); }}
              style={{ margin: 0, height: '38px', width: 'auto', padding: '0 1.5rem' }}
            >
              Clear Filters
            </button>
          </div>

          <div className="so-content" style={{ padding: '1.5rem 2rem' }}>
            <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{total} record(s) found</p>
            <div className="so-table-card">
              <div className="so-table-wrapper">
                <table className="so-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mobile</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="3" className="so-empty">
                          <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="so-empty">
                          <Users size={36} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
                          <p>{filterName ? 'No customers found' : 'No customers yet'}</p>
                        </td>
                      </tr>
                    ) : (
                      paginated.map(c => (
                        <tr 
                          key={c.value} 
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/customer-details/${c.value}`)}
                        >
                          <td style={{ fontWeight: 600, color: themeColor }}>{c.label}</td>
                          <td>
                            {c.mobile ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Phone size={13} style={{ color: '#94a3b8' }} />
                                <span style={{ fontSize: '0.85rem' }}>{c.mobile}</span>
                              </div>
                            ) : <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>
                          <td>
                            {c.email ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Mail size={13} style={{ color: '#94a3b8' }} />
                                <span style={{ fontSize: '0.85rem' }}>{c.email}</span>
                              </div>
                            ) : <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && total > 0 && (
                <div className="so-pagination" style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--so-border)', marginTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--so-text-muted)', fontSize: '0.75rem' }}>
                    Showing {Math.min((currentPage - 1) * pageSize + 1, total)}–{Math.min(currentPage * pageSize, total)} of {total}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Rows:</span>
                      {[20, 50, 100].map(size => (
                        <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }} className={`so-page-btn ${pageSize === size ? 'active' : ''}`}>{size}</button>
                      ))}
                    </div>
                    <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                      <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages}</span>
                      <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronLeft size={14} style={{ transform: 'rotate(180deg)' }} /></button>
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

export default CustomerList;