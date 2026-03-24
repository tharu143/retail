import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus, Filter, MoreVertical, Search, Calendar, Building2,
  Package, DollarSign, Loader2, Edit2, Trash2, Eye, Palette, ChevronDown, ChevronRight, X, ChevronLeft
} from 'lucide-react';
import { format } from 'date-fns';
import './SalesOrder.css';
import NavBar from '../Nav/NavBar';

const API_PATH = '/api/method/kyle_retail.retail_api.api';
const RESOURCE_API = '/api/resource/Purchase Order';

function PurchaseOrderLists() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showActions, setShowActions] = useState(null);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Theme toggle (synced across pages)
  const [poTheme, setPoTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const isGreen = poTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  useEffect(() => {
    localStorage.setItem('legacySubTheme', poTheme);
    document.documentElement.style.setProperty('--so-primary', themeColor);
    document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
    document.documentElement.style.setProperty('--so-primary-light', themeLight);
  }, [poTheme, themeColor, themeColorHover, themeLight]);

  const getSession = () => localStorage.getItem('session') || '';

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_purchase_order_list_retail`, {
        params: { limit: 2000, limit_page_length: 2000 },
        withCredentials: true,
        headers: { 'X-Frappe-SID': getSession() }
      });
      const msg = res.data?.message;
      // Handle new API response structure: { message: { status: "success", data: [...] } }
      if (msg?.status === "success" && Array.isArray(msg?.data)) {
        setOrders(msg.data);
      } else if (Array.isArray(msg)) {
        setOrders(msg);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to fetch POs:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      const matchesSupplier = !filterSupplier ||
        (po.supplier_name?.toLowerCase().includes(filterSupplier.toLowerCase()) ||
          po.supplier?.toLowerCase().includes(filterSupplier.toLowerCase()));
      const matchesStatus = !filterStatus || po.status === filterStatus;
      const matchesFrom = !filterDateFrom || new Date(po.transaction_date) >= new Date(filterDateFrom);
      const matchesTo = !filterDateTo || new Date(po.transaction_date) <= new Date(filterDateTo);
      return matchesSupplier && matchesStatus && matchesFrom && matchesTo;
    });
  }, [orders, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const total = filteredOrders.length;
  const paginated = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-orange-100 text-orange-800',
      'To Receive': 'bg-blue-100 text-blue-800',
      'To Bill': 'bg-rose-100 text-rose-800',
      'To Receive and Bill': 'bg-indigo-100 text-indigo-800',
      'Completed': 'bg-green-100 text-green-800',
      'Cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (name) => {
    if (!confirm('Delete this Purchase Order draft?')) return;
    try {
      await axios.delete(`${RESOURCE_API}/${name}`, {
        withCredentials: true,
        headers: { 'X-Frappe-SID': getSession() }
      });
      fetchOrders();
      setShowActions(null);
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleCancel = async (name) => {
    if (!confirm('Cancel this Purchase Order?')) return;
    try {
      await axios.put(`${RESOURCE_API}/${name}`, { docstatus: 2 }, {
        withCredentials: true,
        headers: { 'X-Frappe-SID': getSession() }
      });
      fetchOrders();
      setShowActions(null);
    } catch (err) {
      alert('Cancel failed');
    }
  };

  const clearFilters = () => {
    setFilterSupplier('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasFilters = filterSupplier || filterStatus || filterDateFrom || filterDateTo;

  return (
    <>
      <NavBar />
      <div className="so-page">
        {/* Page Header */}
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">
              <Package size={20} /> Purchase Orders
            </h1>
            <p className="so-page-subtitle">{total} record(s) found</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle */}
            <button
              onClick={() => setPoTheme(isGreen ? 'blue' : 'green')}
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
              {poTheme.toUpperCase()}
            </button>

            {/* Toggle Filters */}
            <button
              className="so-btn-secondary"
              onClick={() => setShowFilters(f => !f)}
              style={hasFilters ? { borderColor: themeColor, color: themeColor } : {}}
            >
              <Filter size={14} /> Filters {hasFilters ? '●' : ''}
            </button>

            <a href="/#/purchaseorder" className="so-btn-primary" style={{ textDecoration: 'none' }}>
              <Plus size={16} /> Add Purchase Order
            </a>
          </div>
        </div>

        {/* Top Filters Bar */}
        <div className="so-filter-bar" style={{
          background: 'white',
          padding: '1.25rem 2rem',
          borderBottom: '1px solid var(--so-border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          alignItems: 'flex-end'
        }}>
          <div style={{ flex: '1 1 180px' }}>
            <label className="so-filter-label">Supplier</label>
            <input
              className="so-filter-input"
              type="text"
              value={filterSupplier}
              onChange={e => setFilterSupplier(e.target.value)}
              placeholder="Search supplier..."
            />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label className="so-filter-label">Status</label>
            <select
              className="so-filter-input"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '0.45rem' }}
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="To Receive">To Receive</option>
              <option value="To Bill">To Bill</option>
              <option value="To Receive and Bill">To Receive and Bill</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="so-filter-label">From Date</label>
            <input
              className="so-filter-input"
              type="date"
              value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="so-filter-label">To Date</label>
            <input
              className="so-filter-input"
              type="date"
              value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
            />
          </div>
          <div>
            <button className="so-clear-btn" style={{ margin: 0, height: '38px' }} onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem 2rem' }}>
          <p className="so-list-meta" style={{ marginBottom: '1rem', fontWeight: 600 }}>{total} record(s) found</p>
          <div className="so-table-card">
            <div className="so-table-wrapper">
              <table className="so-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Grand Total</th>
                    <th>Billed %</th>
                    <th>Received %</th>
                    <th>Last Updated</th>
                    <th style={{ width: '48px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="so-empty">
                        <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="so-empty">
                        <Package size={36} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
                        No purchase orders found
                      </td>
                    </tr>
                  ) : (
                    paginated.map((po) => (
                      <tr
                        key={po.name}
                        onClick={() => { window.location.href = `/#/purchaseorder?name=${po.name}`; }}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = `${themeColor}08`}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <td>
                          <span style={{ color: themeColor, fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {po.name}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{po.supplier_name || po.supplier}</div>
                          {po.supplier_name && <div style={{ fontSize: '0.72rem', color: 'var(--so-text-muted)' }}>{po.supplier}</div>}
                        </td>
                        <td>
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{
                            backgroundColor: (po.status === 'Completed' || po.status === 'To Receive' || po.status === 'To Bill' || po.status === 'To Receive and Bill') ? `${themeColor}20` : (po.status === 'Draft' ? '#f1f5f9' : '#fee2e2'),
                            color: (po.status === 'Completed' || po.status === 'To Receive' || po.status === 'To Bill' || po.status === 'To Receive and Bill') ? themeColor : (po.status === 'Draft' ? '#64748b' : '#ef4444'),
                            border: `1px solid ${(po.status === 'Completed' || po.status === 'To Receive' || po.status === 'To Bill' || po.status === 'To Receive and Bill') ? `${themeColor}40` : (po.status === 'Draft' ? '#e2e8f0' : '#fecaca')}`
                          }}>
                            {po.status}
                          </span>
                        </td>
                        <td style={{ color: '#475569', fontSize: '0.85rem' }}>
                          {po.transaction_date && format(new Date(po.transaction_date), 'dd-MM-yyyy')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>AED {parseFloat(po.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '80px' }}>
                            <div style={{ flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div style={{ width: `${po.per_billed || 0}%`, height: '100%', background: themeColor }} />
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{Math.round(po.per_billed || 0)}%</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '80px' }}>
                            <div style={{ flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div style={{ width: `${po.per_received || 0}%`, height: '100%', background: themeColor }} />
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{Math.round(po.per_received || 0)}%</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {po.modified && format(new Date(po.modified), 'dd-MM-yyyy')}
                        </td>
                        <td style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowActions(showActions === po.name ? null : po.name); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem', color: '#64748b', display: 'flex' }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {showActions === po.name && (
                            <div style={{
                              position: 'absolute', right: '2.5rem', top: '50%', transform: 'translateY(-50%)',
                              zIndex: 50, background: '#fff', border: '1px solid var(--so-border)',
                              borderRadius: '0.5rem', boxShadow: 'var(--so-shadow)',
                              minWidth: '130px', overflow: 'hidden'
                            }}>
                              <a
                                href={`/#/purchaseorder?name=${po.name}`}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.85rem', color: '#1e293b', textDecoration: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--so-primary-light)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                onClick={() => setShowActions(null)}
                              >
                                <Eye size={13} /> View / Edit
                              </a>
                              {po.status === 'Draft' && (
                                <button
                                  onClick={() => handleDelete(po.name)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#fff1f1'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              )}
                              {po.status !== 'Draft' && po.status !== 'Cancelled' && (
                                <button
                                  onClick={() => handleCancel(po.name)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#fff1f1'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <X size={13} /> Cancel
                                </button>
                              )}
                            </div>
                          )}
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
                      <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }} className={`so-page-btn ${pageSize === size ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', minWidth: '2.5rem' }}>{size}</button>
                    ))}
                  </div>

                  <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft size={14} /></button>
                    <span style={{ fontWeight: 700, color: 'var(--so-primary)', padding: '0 0.5rem', fontSize: '0.75rem' }}>{currentPage} / {totalPages}</span>
                    <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight size={14} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default PurchaseOrderLists;