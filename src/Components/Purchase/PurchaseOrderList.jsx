import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Search, Calendar, Filter, Plus, FileText, ChevronRight,
  Loader2, ShoppingCart, ArrowRightLeft, Clock, History,
  CheckCircle2, AlertCircle, Eye, Printer, Trash2, Edit2, Palette
} from 'lucide-react';
import '../Admin/SalesOrder.css';
import '../Headers/LegacyPOS.css';

const PurchaseOrderList = ({ onNew }) => {
  const theme = useSelector((state) => state.user.theme);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [error, setError] = useState(null);

  // Theme toggle (synced across pages)
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

  const getSession = () => localStorage.getItem('session') || '';
  const BASE_URL = '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_PATH}.get_purchase_orders?searchTerm=${searchTerm || ''}&status=${filterStatus === 'All' ? '' : filterStatus}`, {
        headers: {
          'X-Frappe-SID': getSession(),
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders(data.message || []);
    } catch (err) {
      console.error('Fetch PO error:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filterStatus, searchTerm]);

  const getStatusBadge = (status) => {
    const styles = {
      'Draft': 'bg-slate-100 text-slate-600',
      'Submitted': 'bg-blue-50 text-blue-600 border border-blue-100',
      'Closed': 'bg-slate-200 text-slate-700',
      'Completed': 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      'Partially Received': 'bg-amber-50 text-amber-600 border border-amber-100'
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${styles[status] || styles['Draft']}`}>
        {status}
      </span>
    );
  };

  const STATUS_TABS = ['All', 'Draft', 'Submitted', 'Partially Received', 'Completed'];

  return (
    <div className="so-page" style={{ minHeight: '100vh' }}>
      {/* Page Header */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <ShoppingCart size={20} /> Purchase Directory
          </h1>
          <p className="so-page-subtitle">Manage your procurement workflow</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search PO or Supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                paddingLeft: '2rem', paddingRight: '0.75rem', paddingTop: '0.45rem', paddingBottom: '0.45rem',
                border: '1.5px solid #e2e8f0', borderRadius: '0.375rem', fontSize: '0.8rem',
                width: '220px', outline: 'none', background: '#f8fafc', color: '#1e293b'
              }}
            />
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setPolTheme(isGreen ? 'blue' : 'green')}
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
            {polTheme.toUpperCase()}
          </button>

          <button className="so-btn-primary" onClick={onNew}>
            <Plus size={16} /> Create New PO
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0.6rem 2rem', display: 'flex', gap: '0.4rem', alignItems: 'center'
      }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            style={{
              padding: '0.35rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: filterStatus === tab ? themeLight : 'transparent',
              color: filterStatus === tab ? themeColor : '#94a3b8',
              outline: filterStatus === tab ? `1.5px solid ${themeColor}` : 'none',
            }}
          >
            {tab}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
          {orders.length} order(s)
        </span>
      </div>

      {/* Main Content */}
      <div style={{ padding: '1.5rem 2rem' }}>
        <div className="so-table-card">
          <table className="so-table">
            <thead>
              <tr>
                <th>Identity #</th>
                <th>Supplier &amp; Location</th>
                <th>Posting Matrix</th>
                <th>Analytics</th>
                <th>Commitment Value</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Controls</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="so-empty">
                    <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto 0.5rem' }} />
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Processing Directory...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="so-empty">
                    <AlertCircle size={36} style={{ margin: '0 auto 0.5rem', color: '#ef4444' }} />
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{error}</div>
                    <button
                      onClick={fetchOrders}
                      style={{ marginTop: '0.5rem', color: themeColor, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="so-empty">
                    <FileText size={36} style={{ margin: '0 auto 0.75rem', color: '#e2e8f0' }} />
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>No Transactions Found</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                      No purchase orders match your current filter criteria.
                    </div>
                    <button className="so-btn-primary" onClick={onNew} style={{ marginTop: '1rem' }}>
                      <Plus size={14} /> Start New Purchase
                    </button>
                  </td>
                </tr>
              ) : (
                orders.map((po) => (
                  <tr key={po.name}>
                    {/* Identity */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '0.5rem',
                          background: themeLight, color: themeColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <FileText size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>{po.name}</div>
                          {po.set_warehouse && (
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                              <Clock size={10} /> {po.set_warehouse}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Supplier */}
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
                        {po.supplier_name || po.supplier}
                      </div>
                      <div style={{
                        fontSize: '0.68rem', fontWeight: 700, color: '#003d7c',
                        background: '#f1f5f9', padding: '0.1rem 0.4rem',
                        borderRadius: '0.25rem', display: 'inline-block', marginTop: '0.25rem'
                      }}>
                        ID: {po.supplier}
                      </div>
                    </td>

                    {/* Posting Matrix */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                          <Calendar size={12} style={{ color: '#94a3b8' }} />
                          {new Date(po.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                        </div>
                        {po.schedule_date && (
                          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: themeColor, textTransform: 'uppercase' }}>
                            Due: {new Date(po.schedule_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Analytics */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>
                          {parseFloat(po.total_qty || 0).toFixed(0)}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Products</span>
                      </div>
                      <div style={{ width: '64px', height: '4px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', marginTop: '0.35rem' }}>
                        <div style={{ height: '100%', background: themeColor, borderRadius: '9999px', width: `${Math.min(100, (po.total_qty / 100) * 100)}%` }} />
                      </div>
                    </td>

                    {/* Commitment Value */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.15rem' }}>NET AMOUNT</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, marginRight: '0.2rem' }}>AED</span>
                        {parseFloat(po.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </td>

                    {/* Status */}
                    <td>{getStatusBadge(po.status)}</td>

                    {/* Controls */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                        <button
                          style={{ padding: '0.35rem', borderRadius: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = themeLight; e.currentTarget.style.color = themeColor; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          style={{ padding: '0.35rem', borderRadius: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#2563eb'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          style={{ padding: '0.35rem', borderRadius: '0.375rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#7c3aed'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                          <Printer size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderList;
