import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Plus, Filter, MoreVertical, Search, Calendar, Building2,
  Package, DollarSign, Loader2, Edit2, Trash2, Eye, Palette, ChevronDown, ChevronRight, X, ChevronLeft, ExternalLink,
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import './SalesOrder.css';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import ListCustomizer from './ListCustomizer';


const API_PATH = '/api/method/kyle_retail.retail_api.api';
const RESOURCE_API = '/api/resource/Purchase Order';

const DEFAULT_PO_LIST_COLUMNS = [
  { key: 'name', label: 'ID' },
  { key: 'supplier', label: 'SUPPLIER' },
  { key: 'status', label: 'STATUS' },
  { key: 'transaction_date', label: 'DATE' },
  { key: 'grand_total', label: 'GRAND TOTAL' },
  { key: 'per_billed', label: 'BILLED %' },
  { key: 'per_received', label: 'RECEIVED %' },
  { key: 'modified', label: 'LAST UPDATED' }
];

function PurchaseOrderLists() {
  const [hiddenDefaults, setHiddenDefaults] = useState(() => {
    try {
      const user = localStorage.getItem('user_id') || localStorage.getItem('user_email') || 'default';
      const configKey = `custom_columns_config_${user}_Purchase Order`;
      const saved = localStorage.getItem(configKey) || localStorage.getItem('custom_columns_config_Purchase Order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.hiddenDefaults)) return parsed.hiddenDefaults;
      }
    } catch (e) {}
    return [];
  });
  const [customColumns, setCustomColumns] = useState(() => {
    try {
      const user = localStorage.getItem('user_id') || localStorage.getItem('user_email') || 'default';
      const configKey = `custom_columns_config_${user}_Purchase Order`;
      const savedConfig = localStorage.getItem(configKey) || localStorage.getItem('custom_columns_config_Purchase Order');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed.customColumns)) return parsed.customColumns;
      }
      const saved = localStorage.getItem(`custom_columns_${user}_Purchase Order`) || localStorage.getItem('custom_columns_Purchase Order');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);
  const [showActions, setShowActions] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('modified');
  const [sortDirection, setSortDirection] = useState('desc');

  // Filters
  const location = useLocation();
  const navigate = useNavigate();
  const [filterSupplier, setFilterSupplier] = useState(location.state?.search || '');
  const [filterStatus, setFilterStatus] = useState('');
  const getTodayDate = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
  };

  const [filterDateFrom, setFilterDateFrom] = useState(() => getTodayDate());
  const [filterDateTo, setFilterDateTo] = useState(() => getTodayDate());

  // Theme Hook
  const { legacySubTheme, isGreen, themeColor, themeColorHover, themeLight, toggleTheme } = useLegacyTheme();
  const { warehouse, user_roles } = useSelector((state) => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");


  const getSession = () => localStorage.getItem('session') || '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const supplierParam = params.get('supplier');

    if (supplierParam) {
      setFilterSupplier(supplierParam);
      setShowFilters(true);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [customColumns]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_purchase_order_list_retail`, {
        params: { 
          limit: 2000, 
          limit_page_length: 2000,
          warehouse: !isAdmin ? warehouse : undefined,
          extra_fields: JSON.stringify(customColumns)
        },
        withCredentials: true,
        headers: { 'X-Frappe-SID': getSession() }
      });
      const msg = res.data?.message;
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      const matchesSupplier = !filterSupplier ||
        (po.supplier_name?.toLowerCase().includes(filterSupplier.toLowerCase()) ||
          po.supplier?.toLowerCase().includes(filterSupplier.toLowerCase()));
      const matchesStatus = !filterStatus || po.status === filterStatus;
      const poDateStr = String(po.transaction_date || '').slice(0, 10);
      const matchesFrom = !filterDateFrom || poDateStr >= String(filterDateFrom).slice(0, 10);
      const matchesTo = !filterDateTo || poDateStr <= String(filterDateTo).slice(0, 10);
      return matchesSupplier && matchesStatus && matchesFrom && matchesTo;
    });
  }, [orders, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const sortedOrders = useMemo(() => {
    if (!sortField) return filteredOrders;
    return [...filteredOrders].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (sortField === 'transaction_date' || sortField === 'modified' || sortField === 'creation') {
        const dateA = new Date(valA || 0).getTime();
        const dateB = new Date(valB || 0).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortField === 'grand_total' || sortField === 'per_billed' || sortField === 'per_received') {
        const numA = parseFloat(valA) || 0;
        const numB = parseFloat(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      return sortDirection === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredOrders, sortField, sortDirection]);

  const total = sortedOrders.length;
  const paginated = sortedOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={11} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={12} style={{ color: themeColor || '#0082f6', marginLeft: '4px' }} />
      : <ArrowDown size={12} style={{ color: themeColor || '#0082f6', marginLeft: '4px' }} />;
  };

  return (
    <>
      <div className="so-page">
        {/* Page Header */}
        <div className="so-page-header" style={{ background: '#fff', padding: '0.85rem 2rem 1.25rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Package size={22} style={{ color: themeColor || '#0082f6' }} strokeWidth={2.5} />
              <span style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                PURCHASE ORDERS
              </span>
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              Manage and track all purchase orders
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Theme Toggle */}
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
                transition: 'all 0.15s ease-in-out',
                boxSizing: 'border-box'
              }}
              title="Toggle Theme"
            >
              <Palette size={14} />
              <span>{isGreen ? 'BLUE' : 'GREEN'}</span>
            </button>

            {/* Toggle Filters */}
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '38px',
                padding: '0 16px',
                background: '#ffffff',
                color: hasFilters || showFilters ? (themeColor || '#0082f6') : '#475569',
                border: `1.5px solid ${hasFilters || showFilters ? (themeColor || '#0082f6') : '#cbd5e1'}`,
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease-in-out',
                boxSizing: 'border-box'
              }}
            >
              <Filter size={14} />
              <span>FILTERS</span>
              {hasFilters && <span style={{ width: 6, height: 6, borderRadius: '50%', background: themeColor || '#0082f6' }} />}
            </button>

            {/* ADD PURCHASE ORDER */}
            <button
              type="button"
              onClick={() => navigate('/purchaseorder')}
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
                boxShadow: '0 2px 4px rgba(0, 130, 246, 0.25)',
                transition: 'all 0.15s ease-in-out',
                boxSizing: 'border-box'
              }}
            >
              <Plus size={16} />
              <span>ADD PURCHASE ORDER</span>
            </button>
          </div>
        </div>

        <div className="so-layout" style={{ background: '#f8fafc', padding: '1.5rem 2rem' }}>
          {/* Top Filters Bar */}
          {showFilters && (
            <div className="so-filter-bar animate-in fade-in duration-200" style={{
              background: '#f8fafc',
              padding: '0 0 1.25rem 0',
              borderBottom: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.25rem',
              alignItems: 'flex-end',
              marginBottom: '0.5rem'
            }}>
              <div style={{ flex: '1 1 220px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>SUPPLIER</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 2 }} />
                  <input
                    className="so-filter-input so-filter-input-icon"
                    type="text"
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                    placeholder="Search supplier..."
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>STATUS</label>
                <select
                  className="so-filter-input"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', fontWeight: 600, color: '#0f172a' }}
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
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>FROM DATE</label>
                <input
                  className="so-filter-input"
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                  onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                  style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', color: filterDateFrom ? '#0f172a' : '#64748b', fontWeight: 500 }}
                />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>TO DATE</label>
                <input
                  className="so-filter-input"
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  onFocus={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                  onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                  style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', color: filterDateTo ? '#0f172a' : '#64748b', fontWeight: 500 }}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    height: '38px',
                    padding: '0 18px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    color: hasFilters ? '#ef4444' : '#64748b',
                    border: `1px solid ${hasFilters ? '#fecaca' : '#cbd5e1'}`,
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
                  {hasFilters ? <X size={14} /> : null}
                  <span>CLEAR</span>
                </button>
              </div>
            </div>
          )}

          <div className="so-content" style={{ padding: 0 }}>
            <p className="so-list-meta" style={{ marginBottom: '0.75rem', fontWeight: 600, color: '#64748b', fontSize: '13px' }}>{total} record(s) found</p>
            <div className="so-table-card" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
            <div className="so-table-wrapper">
              <table className="so-table">
                <thead>
                  <tr>
                    {!hiddenDefaults.includes('name') && (
                      <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span>ID</span>
                          {renderSortIcon('name')}
                        </div>
                      </th>
                    )}
                    {!hiddenDefaults.includes('supplier') && (
                      <th onClick={() => handleSort('supplier')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span>SUPPLIER</span>
                          {renderSortIcon('supplier')}
                        </div>
                      </th>
                    )}
                    {!hiddenDefaults.includes('status') && (
                      <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span>STATUS</span>
                          {renderSortIcon('status')}
                        </div>
                      </th>
                    )}
                    {!hiddenDefaults.includes('transaction_date') && (
                      <th onClick={() => handleSort('transaction_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span>DATE</span>
                          {renderSortIcon('transaction_date')}
                        </div>
                      </th>
                    )}
                    {!hiddenDefaults.includes('grand_total') && (
                      <th onClick={() => handleSort('grand_total')} className="text-right" style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                          <span>GRAND TOTAL</span>
                          {renderSortIcon('grand_total')}
                        </div>
                      </th>
                    )}
                    {!hiddenDefaults.includes('per_billed') && (
                      <th onClick={() => handleSort('per_billed')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span>BILLED %</span>
                          {renderSortIcon('per_billed')}
                        </div>
                      </th>
                    )}
                    {!hiddenDefaults.includes('per_received') && (
                      <th onClick={() => handleSort('per_received')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span>RECEIVED %</span>
                          {renderSortIcon('per_received')}
                        </div>
                      </th>
                    )}
                    {!hiddenDefaults.includes('modified') && (
                      <th onClick={() => handleSort('modified')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span>LAST UPDATED</span>
                          {renderSortIcon('modified')}
                        </div>
                      </th>
                    )}
                    {customColumns.map(col => (
                      <th key={col} onClick={() => handleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <span>{col.replace(/_/g, ' ').toUpperCase()}</span>
                          {renderSortIcon(col)}
                        </div>
                      </th>
                    ))}
                    <th style={{ width: '48px', textAlign: 'center', verticalAlign: 'middle', padding: '0 4px' }}>
                      <ListCustomizer
                        doctype="Purchase Order"
                        defaultColumns={DEFAULT_PO_LIST_COLUMNS}
                        iconOnly
                        onSave={(cols, hidden) => {
                          setCustomColumns(cols);
                          setHiddenDefaults(hidden);
                        }}
                        themeColor={themeColor || '#0082f6'}
                        title="Configure Columns"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={DEFAULT_PO_LIST_COLUMNS.length - hiddenDefaults.length + customColumns.length + 1} className="so-empty">
                        <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={DEFAULT_PO_LIST_COLUMNS.length - hiddenDefaults.length + customColumns.length + 1} className="so-empty">
                        <Package size={36} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
                        No purchase orders found
                      </td>
                    </tr>
                  ) : (
                    paginated.map((po) => (
                      <tr
                        key={po.name}
                        onClick={() => { navigate(`/purchaseorder?name=${po.name}`); }}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = `${themeColor}08`}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        {!hiddenDefaults.includes('name') && (
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigate(`/purchaseorder?name=${po.name}`); }}
                                title="Open Record"
                                style={{ color: themeColor, textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              >
                                <ExternalLink size={12} style={{ opacity: 0.6 }} />
                              </button>
                              <span style={{ color: themeColor, fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                {po.name}
                              </span>
                            </div>
                          </td>
                        )}
                        {!hiddenDefaults.includes('supplier') && (
                          <td>
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterSupplier(po.supplier_name || po.supplier || '');
                                setShowFilters(true);
                              }}
                              title="Click to filter by this supplier"
                              style={{ fontWeight: 600, cursor: 'pointer', display: 'inline-block' }}
                              onMouseEnter={e => e.currentTarget.style.color = themeColor || '#0082f6'}
                              onMouseLeave={e => e.currentTarget.style.color = ''}
                            >
                              {po.supplier_name || po.supplier}
                            </div>
                            {po.supplier_name && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFilterSupplier(po.supplier || '');
                                  setShowFilters(true);
                                }}
                                style={{ fontSize: '0.72rem', color: 'var(--so-text-muted)', cursor: 'pointer' }}
                                title="Click to filter by ID"
                              >
                                {po.supplier}
                              </div>
                            )}
                          </td>
                        )}
                        {!hiddenDefaults.includes('status') && (
                          <td>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterStatus(po.status);
                                setShowFilters(true);
                              }}
                              title="Click to filter by status"
                              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" 
                              style={{
                                backgroundColor: (po.status === 'Completed' || po.status === 'To Receive' || po.status === 'To Bill' || po.status === 'To Receive and Bill') ? `${themeColor}20` : (po.status === 'Draft' ? '#f1f5f9' : '#fee2e2'),
                                color: (po.status === 'Completed' || po.status === 'To Receive' || po.status === 'To Bill' || po.status === 'To Receive and Bill') ? themeColor : (po.status === 'Draft' ? '#64748b' : '#ef4444'),
                                border: `1px solid ${(po.status === 'Completed' || po.status === 'To Receive' || po.status === 'To Bill' || po.status === 'To Receive and Bill') ? `${themeColor}40` : (po.status === 'Draft' ? '#e2e8f0' : '#fecaca')}`,
                                cursor: 'pointer'
                              }}
                            >
                              {po.status}
                            </span>
                          </td>
                        )}
                        {!hiddenDefaults.includes('transaction_date') && (
                          <td style={{ color: '#475569', fontSize: '0.85rem' }}>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (po.transaction_date) {
                                  setFilterDateFrom(po.transaction_date);
                                  setFilterDateTo(po.transaction_date);
                                  setShowFilters(true);
                                }
                              }}
                              title="Click to filter by date"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={e => e.currentTarget.style.color = themeColor || '#0082f6'}
                              onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                            >
                              {po.transaction_date && format(new Date(po.transaction_date), 'dd-MM-yyyy')}
                            </span>
                          </td>
                        )}
                        {!hiddenDefaults.includes('grand_total') && (
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%' }}>
                              <DirhamIcon size={12} />
                              <span>{parseFloat(po.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          </td>
                        )}
                        {!hiddenDefaults.includes('per_billed') && (
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '80px' }}>
                              <div style={{ flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                                <div style={{ width: `${po.per_billed || 0}%`, height: '100%', background: themeColor }} />
                              </div>
                              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{Math.round(po.per_billed || 0)}%</span>
                            </div>
                          </td>
                        )}
                        {!hiddenDefaults.includes('per_received') && (
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '80px' }}>
                              <div style={{ flex: 1, height: '4px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                                <div style={{ width: `${po.per_received || 0}%`, height: '100%', background: themeColor }} />
                              </div>
                              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{Math.round(po.per_received || 0)}%</span>
                            </div>
                          </td>
                        )}
                        {!hiddenDefaults.includes('modified') && (
                          <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {po.modified && format(new Date(po.modified), 'dd-MM-yyyy')}
                          </td>
                        )}
                        {customColumns.map(col => (
                          <td key={col} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            {po[col] !== undefined && po[col] !== null ? String(po[col]) : '-'}
                          </td>
                        ))}
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
                              <button
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', fontSize: '0.85rem', color: '#1e293b', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--so-primary-light)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                onClick={(e) => { e.stopPropagation(); setShowActions(null); navigate(`/purchaseorder?name=${po.name}`); }}
                              >
                                <Eye size={13} /> View / Edit Record
                              </button>
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
    </div>
    </>
  );
}

export default PurchaseOrderLists;