import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, ShoppingCart, Receipt, Calendar, User, Layers,
  CheckCircle2, Clock, CreditCard, Palette, Loader2, ChevronLeft, ChevronRight,
  ArrowRight, FileText, Filter, Save
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import Swal from 'sweetalert2';
import '../Admin/SalesOrder.css';

const API_PATH_C = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

/* ==================== UI HELPERS ==================== */
const StatusBadge = ({ docstatus }) => {
  const isSubmitted = docstatus === 1;
  const isCancelled = docstatus === 2;

  if (isCancelled) {
    return (
      <span className="so-badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
        Cancelled
      </span>
    );
  }

  return (
    <span className={`so-badge ${isSubmitted ? 'so-badge-submitted' : 'so-badge-draft'}`}>
      {isSubmitted ? 'Submitted' : 'Draft'}
    </span>
  );
};

export default function SalesOrderList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Theme logic
  const { themeColor, themeLight, toggleTheme, legacySubTheme, isGreen } = useLegacyTheme();

  // Pagination states
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Creation Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [formData, setFormData] = useState({});
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Sales Order', {
        params: {
          limit_page_length: 2000,
          fields: JSON.stringify(['name', 'customer', 'customer_name', 'transaction_date', 'grand_total', 'docstatus', 'status', 'total_qty', 'base_total', 'naming_series']),
          order_by: 'modified desc'
        },
        withCredentials: true
      });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch sales orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  const stats = useMemo(() => {
    const total = orders.length;
    const submitted = orders.filter(o => o.docstatus === 1).length;
    const drafts = total - submitted;
    const totalValue = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
    return { total, submitted, drafts, totalValue };
  }, [orders]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);

  const handleRowClick = (name) => {
    navigate(`/salesorder-details/${name}`);
  };

  const openCreateModal = async () => {
    setIsModalOpen(true);
    if (!metadata) {
      try {
        setLoadingMetadata(true);
        const res = await axios.get(`${API_PATH_C}.get_doctype_metadata`, {
          params: { doctype: 'Sales Order' },
          withCredentials: true
        });
        setMetadata(res.data.message || null);

        // Initialize form with defaults if any
        const initial = {};
        (res.data.message?.fields || []).forEach(f => {
          if (f.default) initial[f.fieldname] = f.default;
          else if (f.fieldtype === 'Date') initial[f.fieldname] = new Date().toISOString().split('T')[0];
        });
        setFormData(initial);
      } catch (err) {
        Swal.fire('Metadata Error', 'Could not fetch Sales Order structure', 'error');
      } finally {
        setLoadingMetadata(false);
      }
    }
  };

  const recalculate = (currentForm) => {
    const items = currentForm.items || [];
    const base_total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    const grand_total = base_total;
    return { ...currentForm, base_total, grand_total };
  };

  const handleInputChange = (fieldname, value) => {
    setFormData(prev => ({ ...prev, [fieldname]: value }));
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), { item_code: '', item_name: '', qty: 1, rate: 0, amount: 0, uom: 'Nos' }]
    }));
  };

  const removeItemRow = (idx) => {
    setFormData(prev => {
      const nextItems = (prev.items || []).filter((_, i) => i !== idx);
      return recalculate({ ...prev, items: nextItems });
    });
  };

  const updateItemRow = (idx, field, value) => {
    setFormData(prev => {
      const nextItems = [...(prev.items || [])];
      nextItems[idx] = { ...nextItems[idx], [field]: value };
      if (field === 'qty' || field === 'rate') {
        nextItems[idx].amount = (parseFloat(nextItems[idx].qty) || 0) * (parseFloat(nextItems[idx].rate) || 0);
      }
      return recalculate({ ...prev, items: nextItems });
    });
  };

  const submitCreate = async () => {
    try {
      if (!formData.customer) return Swal.fire('Error', 'Customer is required', 'warning');
      if (!formData.items || formData.items.length === 0) return Swal.fire('Error', 'No items added', 'warning');

      setSavingOrder(true);
      const res = await axios.post('/api/resource/Sales Order', formData, { withCredentials: true });
      Swal.fire({ icon: 'success', title: 'Order Created', text: `ID: ${res.data.data.name}`, timer: 3000 });
      setIsModalOpen(false);
      fetchOrders();
    } catch (err) {
      Swal.fire('Failed', err.response?.data?._server_messages || err.message, 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div className="so-page">
      {/* 1. Header Section */}
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <ShoppingCart size={20} /> Sales Orders
          </h1>
          <p className="so-page-subtitle">Manage and track all sales</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              background: '#f8fafc',
              border: `1.5px solid ${themeColor}`,
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: themeColor,
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            <Palette size={13} />
            {legacySubTheme.toUpperCase()}
          </button>
          <button className="so-btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> Create Sales Order
          </button>
        </div>
      </div>

      <div className="so-layout">
        {/* 2. Actions / Filter Bar */}
        <div className="so-filter-bar">
          <div style={{ flex: '1 1 300px' }}>
            <label className="so-filter-label">Search Order Matrix</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="so-filter-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Search by Order ID or Customer..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
          <button
            className="so-clear-btn"
            style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0, fontWeight: 600 }}
            onClick={() => setSearchTerm('')}
          >
            Clear Search
          </button>
        </div>

        {/* 3. Executive Dashboard (Summary Bar) */}
        <div style={{ padding: '1.25rem 1.5rem 0' }}>
          <div className="so-summary-bar">
            <div className="so-summary-item">
              <span className="so-summary-label">Total Orders</span>
              <span className="so-summary-value grand">{stats.total}</span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Submitted</span>
              <span className="so-summary-value" style={{ color: '#10b981' }}>{stats.submitted}</span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Drafts</span>
              <span className="so-summary-value" style={{ color: '#f59e0b' }}>{stats.drafts}</span>
            </div>
            <div className="so-summary-divider" />
            <div className="so-summary-item">
              <span className="so-summary-label">Total Amount</span>
              <span className="so-summary-value">AED {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* 4. Main Directory Table */}
        <div className="so-content">
          <div className="so-list-meta">{filteredOrders.length} record(s) found</div>

          <div className="so-table-card">
            <div className="so-table-wrapper">
              <table className="so-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="so-empty">
                        <Loader2 size={32} className="so-spinner" style={{ margin: '0 auto' }} />
                        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Loading Orders...</p>
                      </td>
                    </tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="so-empty">
                        No orders found
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => (
                      <tr
                        key={order.name}
                        onClick={() => handleRowClick(order.name)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '38px', height: '38px', borderRadius: '10px',
                              background: themeLight, color: themeColor,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <ShoppingCart size={18} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: 'var(--so-text-heading)', fontSize: '0.85rem' }}>{order.name}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--so-text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>{order.naming_series || 'SAL-ORD'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <User size={14} className="text-slate-400" />
                            <span style={{ fontWeight: 600 }}>{order.customer_name || order.customer}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={14} className="text-slate-400" />
                            <span style={{ fontWeight: 600 }}>{order.transaction_date}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800 }}>
                            AED {parseFloat(order.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--so-text-muted)', fontWeight: 600 }}>
                            Items: {order.total_qty || 0}
                          </div>
                        </td>
                        <td>
                          <StatusBadge docstatus={order.docstatus} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ color: themeColor }}>
                              <ArrowRight size={18} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Grid */}
            {!loading && filteredOrders.length > 0 && (
              <div className="so-pagination" style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--so-border)', margin: 0 }}>
                <span style={{ fontWeight: 600 }}>Showing {Math.min((currentPage - 1) * pageSize + 1, filteredOrders.length)}–{Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} records</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.6 }}>Page Capacity:</span>
                    <select
                      value={pageSize}
                      onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                      className="so-page-btn"
                      style={{ padding: '0.2rem 0.5rem' }}
                    >
                      {[10, 20, 50, 100].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                    </select>
                  </div>
                  <div className="so-pagination-btns" style={{ borderLeft: '1px solid var(--so-border)', paddingLeft: '1rem' }}>
                    <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontWeight: 800, color: themeColor, padding: '0 0.5rem' }}>{currentPage} / {totalPages}</span>
                    <button className="so-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Creation Full-Screen Overlay */}
      {isModalOpen && (
        <div className="so-modal-overlay" style={{ padding: 0 }}>
          <div className="so-modal so-modal-full" onClick={e => e.stopPropagation()}>
            <div className="so-modal-header" style={{ padding: '1rem 2rem', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.6rem', background: themeLight, color: themeColor, borderRadius: '12px' }}>
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h3 className="so-modal-title">Create New Sales Order</h3>
                  <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>INITIALIZE NEW SALES PROTOCOL</p>
                </div>
              </div>
              <button className="so-modal-close" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>

            <div className="so-modal-body" style={{ background: '#f8fafc', padding: '2rem' }}>
              {loadingMetadata ? (
                <div style={{ padding: '8rem', textAlign: 'center' }}>
                  <Loader2 size={40} className="so-spinner" style={{ margin: '0 auto' }} />
                  <p style={{ marginTop: '1.25rem', fontSize: '0.75rem', fontWeight: 800, opacity: 0.6 }}>HYDRATING METADATA...</p>
                </div>
              ) : metadata ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

                  {/* Order level inputs (4 fields per row) */}
                  <div className="so-card">
                    <div className="so-card-body">
                      <div className="so-form-grid">
                        {metadata.fields
                          .filter(f => !['Section Break', 'Column Break', 'Table', 'HTML'].includes(f.fieldtype) && !f.hidden)
                          .map(f => (
                            <div key={f.fieldname} className="so-field">
                              <label className="so-label">{f.label} {f.reqd && '*'}</label>
                              <input
                                className="so-input"
                                type={f.fieldtype === 'Date' ? 'date' : 'text'}
                                value={formData[f.fieldname] || ''}
                                onChange={e => handleInputChange(f.fieldname, e.target.value)}
                                placeholder={`Enter ${f.label}...`}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Item Table */}
                  <div className="so-card">
                    <div className="so-card-header">
                      <h4 className="so-card-title">Item List</h4>
                      <button className="so-btn-ghost" onClick={addItemRow}>
                        <Plus size={14} /> Add Line Item
                      </button>
                    </div>
                    <div className="so-table-wrapper" style={{ maxHeight: 'none' }}>
                      <table className="so-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40%' }}>Item Code / Description</th>
                            <th style={{ textAlign: 'center' }}>Quantity</th>
                            <th style={{ textAlign: 'right' }}>Unit Rate</th>
                            <th style={{ textAlign: 'right' }}>Total Amount</th>
                            <th style={{ width: '50px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(formData.items || []).map((item, idx) => (
                            <tr key={idx}>
                              <td>
                                <input className="so-td-input" value={item.item_code} onChange={e => updateItemRow(idx, 'item_code', e.target.value)} placeholder="Search item..." />
                              </td>
                              <td>
                                <input className="so-td-input" style={{ textAlign: 'center' }} type="number" value={item.qty} onChange={e => updateItemRow(idx, 'qty', e.target.value)} />
                              </td>
                              <td>
                                <input className="so-td-input" style={{ textAlign: 'right' }} type="number" value={item.rate} onChange={e => updateItemRow(idx, 'rate', e.target.value)} />
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                AED {(parseFloat(item.amount) || 0).toFixed(2)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <X size={16} onClick={() => removeItemRow(idx)} style={{ cursor: 'pointer', color: '#ef4444' }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stats Summary */}
                  <div className="so-summary-bar" style={{ alignSelf: 'flex-end', minWidth: '400px' }}>
                    <div className="so-summary-item">
                      <span className="so-summary-label">Subtotal</span>
                      <span className="so-summary-value">AED {(formData.base_total || 0).toLocaleString()}</span>
                    </div>
                    <div className="so-summary-divider" />
                    <div className="so-summary-item" style={{ textAlign: 'right' }}>
                      <span className="so-summary-label">Grand Total</span>
                      <span className="so-summary-value grand">AED {(formData.grand_total || 0).toLocaleString()}</span>
                    </div>
                  </div>

                </div>
              ) : null}
            </div>

            <div className="so-modal-footer" style={{ padding: '1.5rem 2.5rem' }}>
              <button disabled={savingOrder} className="so-btn-secondary" style={{ padding: '0.65rem 2rem' }} onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button disabled={savingOrder || !metadata} className="so-btn-primary" style={{ padding: '0.65rem 2.5rem' }} onClick={submitCreate}>
                {savingOrder ? <Loader2 className="so-spinner" /> : <Save size={16} />} Save Sales Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}