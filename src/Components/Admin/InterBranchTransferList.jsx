import PageHeader from '../UI/PageHeader';
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Plus, Filter, Building2, Package, Loader2, ArrowRightLeft, ArrowRight, ChevronRight, FileText, Activity, Search, Palette
} from 'lucide-react';
import { format } from 'date-fns';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';
import './SalesOrder.css';

const API_PATH = '/api/method/kyle_retail.retail_api.api';

function InterBranchTransferList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' or 'outgoing'
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  
  const { themeColor, themeColorHover, themeLight, isGreen, toggleTheme, legacySubTheme } = useLegacyTheme();
  const warehouse = useSelector((state) => state.user.warehouse);

  const getSession = () => localStorage.getItem('session') || '';

  useEffect(() => {
    fetchRequests();
  }, [warehouse, activeTab]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_inter_branch_requests`, {
        params: { 
            warehouse: warehouse,
            direction: activeTab === 'incoming' ? 'incoming' : 'outgoing'
        },
        withCredentials: true,
        headers: { 'X-Frappe-SID': getSession() }
      });
      setRequests(res.data?.message || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Transferred': return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
      case 'Requested': return { bg: '#eff6ff', text: '#1d4ed8', border: '#dbeafe' };
      case 'Stopped': return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
      case 'Draft': return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
      default: return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Transferred': return 'so-badge-submitted';
      case 'Requested': return 'so-badge-draft';
      case 'Stopped': return '';
      case 'Draft': return 'so-badge-draft';
      default: return 'so-badge-draft';
    }
  };

  const filtered = requests.filter(r => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.target_warehouse?.toLowerCase().includes(q) ||
      r.set_from_warehouse?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="erp-page so-page">
      {/* Page Header */}
      <PageHeader className="so-page-header" style={{ padding: '1.25rem 2rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <h1 className="so-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <ArrowRightLeft size={22} style={{ color: themeColor }} />
            <span style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>STOCK TRANSFER REQUESTS</span>
          </h1>
          <p className="so-page-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>{requests.length} TRANSFER REQUESTS INDEXED</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={toggleTheme} 
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              height: '38px', padding: '0 1rem', background: '#ffffff',
              border: `1.5px solid ${themeColor}`, borderRadius: '8px',
              fontSize: '12px', fontWeight: 800, color: themeColor,
              cursor: 'pointer', transition: 'all 0.15s ease-in-out',
              textTransform: 'uppercase', letterSpacing: '0.04em', boxSizing: 'border-box'
            }}
          >
            <Palette size={14} /> {legacySubTheme.toUpperCase()}
          </button>
          <button 
            onClick={() => navigate('/newinterbranchrequest')}
            className="erp-button erp-button-primary so-btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              height: '38px', padding: '0 1rem', background: themeColor,
              color: '#ffffff', border: 'none', borderRadius: '8px',
              fontSize: '12px', fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.15s ease-in-out',
              boxSizing: 'border-box'
            }}
          >
            <Plus size={16} /> New Request
          </button>
        </div>
      </PageHeader>

      {/* Tab Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '0', 
        padding: '0 2rem', 
        background: '#fff', 
        borderBottom: '1px solid var(--so-border)' 
      }}>
        <button 
          onClick={() => setActiveTab('incoming')}
          style={{
            padding: '0.85rem 1.25rem',
            fontSize: '0.65rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'incoming' ? `2px solid ${themeColor}` : '2px solid transparent',
            color: activeTab === 'incoming' ? themeColor : '#94a3b8',
            transition: 'all 0.2s'
          }}
        >
          Incoming Requests (To {warehouse?.replace(' - KSPL', '') || 'Branch'})
        </button>
        <button 
          onClick={() => setActiveTab('outgoing')}
          style={{
            padding: '0.85rem 1.25rem',
            fontSize: '0.65rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'outgoing' ? `2px solid ${themeColor}` : '2px solid transparent',
            color: activeTab === 'outgoing' ? themeColor : '#94a3b8',
            transition: 'all 0.2s'
          }}
        >
          My Outbound Requests
        </button>
      </div>

      {/* Outer Layout Area */}
      <div className="so-layout" style={{ flexDirection: 'column', background: '#f8fafc', padding: '1.5rem 2rem' }}>
        {/* Content Area */}
        <div className="so-content" style={{ padding: 0, flex: 1, background: 'transparent' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', zIndex: 2 }} />
            <input
              className="so-filter-input"
              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff', paddingLeft: '2.25rem' }}
              placeholder="Search Request ID, Branch, Status..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Table Card */}
          <div className="erp-table-card so-table-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
          <div className="erp-table-scroll so-table-wrapper">
            <table className="erp-table so-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>{activeTab === 'incoming' ? 'Requesting Branch' : 'Target Branch'}</th>
                  <th>Status</th>
                  <th>Items Requested</th>
                  <th style={{ textAlign: 'center' }}>Total Qty</th>
                  <th style={{ textAlign: 'right' }}>Date Requested</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>
                      <Loader2 size={32} className="animate-spin" style={{ color: themeColor, margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', fontWeight: 700 }}>
                      NO TRANSFER REQUESTS FOUND
                    </td>
                  </tr>
                ) : (
                  filtered.map((req) => {
                    const style = getStatusStyle(req.status);
                    return (
                      <tr 
                        key={req.name} 
                        onClick={() => navigate(`/interbranchrequest/${req.name}`)} 
                      >
                        {/* 1. Request ID */}
                        <td>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: themeColor, background: themeLight, padding: '4px 10px', borderRadius: '6px', fontSize: '11px' }}>
                            {req.name}
                          </span>
                        </td>
                        
                        {/* 2. Directional Branch & Staff Audit */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: themeLight, color: themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Building2 size={18} />
                            </div>
                            <div>
                              <p style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px', margin: 0 }}>
                                {activeTab === 'incoming' ? (req.set_warehouse || req.target_warehouse)?.replace(' - KSPL', '') : req.set_from_warehouse?.replace(' - KSPL', '')}
                              </p>
                              <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, margin: '2px 0 0 0' }}>
                                Req by: {req.requested_by_employee_name || 'Staff'}
                                {req.dispatched_by_employee_name ? ` • Transfer: ${req.dispatched_by_employee_name}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        
                        {/* 3. Status Badge */}
                        <td>
                          <span 
                            className="so-badge"
                            style={{
                              backgroundColor: style.bg, 
                              color: style.text, 
                              borderColor: style.border,
                              border: `1px solid ${style.border}`
                            }}
                          >
                            {req.status}
                          </span>
                        </td>
                        
                        {/* 4. Items Details */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {req.items?.slice(0, 2).map((it, idx) => (
                              <div key={idx} style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontFamily: 'monospace', fontWeight: 800 }}>{it.item_code}</span>
                                <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.item_name}</span>
                              </div>
                            ))}
                            {req.items?.length > 2 && (
                              <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '2px', marginTop: '2px' }}>
                                +{req.items.length - 2} more product(s)
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* 5. Quantity */}
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#334155', fontSize: '13px' }}>
                          {req.total_qty}
                        </td>
                        
                        {/* 6. Date */}
                        <td style={{ textAlign: 'right', fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                          {req.transaction_date && format(new Date(req.transaction_date), 'dd MMM yyyy')}
                        </td>
                        
                        {/* 7. Manage Action */}
                        <td style={{ textAlign: 'center' }}>
                           <button 
                             className="erp-button erp-button-secondary so-btn-secondary"
                             style={{ fontSize: '0.65rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                             onClick={(e) => { e.stopPropagation(); navigate(`/interbranchrequest/${req.name}`); }}
                           >
                             Manage <ChevronRight size={12} />
                           </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

export default InterBranchTransferList;
