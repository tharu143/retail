import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Plus, Filter, MoreVertical, Search, Calendar, Building2,
  Package, DollarSign, Loader2, Edit2, Trash2, Eye, Palette, ChevronDown, ChevronRight, X, ChevronLeft, ArrowRightLeft, CheckCircle2, XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import './SalesOrder.css'; // Reuse table styles
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

const API_PATH = '/api/method/kyle_retail.retail_api.api';

function InterBranchTransferList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' or 'outgoing'
  const [showFilters, setShowFilters] = useState(false);
  
  const { themeColor, themeColorHover, themeLight, isGreen } = useLegacyTheme();
  const warehouse = useSelector((state) => state.user.warehouse);
  const user = useSelector((state) => state.user.user);

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
      case 'Transferred': return { bg: `${themeColor}20`, text: themeColor, border: `${themeColor}40` };
      case 'Requested': return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
      case 'Stopped': return { bg: '#fee2e2', text: '#ef4444', border: '#fecaca' };
      default: return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
    }
  };

  return (
    <div className="so-page">
      <div className="so-page-header">
        <div>
          <h1 className="so-page-title">
            <ArrowRightLeft size={20} /> Stock Transfers
          </h1>
          <p className="so-page-subtitle">Manage inter-branch material requests</p>
        </div>
        <div className="flex gap-3">
          <a href="/#/newinterbranchrequest" className="so-btn-primary" style={{ textDecoration: 'none' }}>
            <Plus size={16} /> New Request
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-slate-200 bg-white flex gap-8">
        <button 
          onClick={() => setActiveTab('incoming')}
          className={`py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'incoming' ? `border-[${themeColor}] text-[${themeColor}]` : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          style={activeTab === 'incoming' ? { borderColor: themeColor, color: themeColor } : {}}
        >
          Incoming Requests (To {warehouse || 'Branch'})
        </button>
        <button 
          onClick={() => setActiveTab('outgoing')}
          className={`py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'outgoing' ? `border-[${themeColor}] text-[${themeColor}]` : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          style={activeTab === 'outgoing' ? { borderColor: themeColor, color: themeColor } : {}}
        >
          My Requests (Outbound)
        </button>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        <div className="so-table-card">
          <div className="so-table-wrapper">
            <table className="so-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>{activeTab === 'incoming' ? 'Requesting Branch' : 'Source Branch'}</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Qty</th>
                  <th>Date</th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={32} /></td></tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="so-empty">
                        <Package size={40} className="mb-4 opacity-20" />
                        No transfer requests found for this branch
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => {
                    const style = getStatusStyle(req.status);
                    return (
                      <tr key={req.name} onClick={() => window.location.href = `/#/interbranchrequest/${req.name}`} style={{ cursor: 'pointer' }}>
                        <td className="font-bold text-[${themeColor}]" style={{ color: themeColor }}>{req.name}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-slate-400" />
                            <span className="font-bold">{activeTab === 'incoming' ? req.target_warehouse : req.set_from_warehouse}</span>
                          </div>
                        </td>
                        <td>
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border" style={{
                            backgroundColor: style.bg, color: style.text, borderColor: style.border
                          }}>
                            {req.status}
                          </span>
                        </td>
                        <td>
                            <div className="flex flex-col gap-1">
                                {req.items?.slice(0, 2).map((it, idx) => (
                                    <div key={idx} className="text-[11px] font-medium text-slate-600 truncate max-w-[200px]">
                                        {it.item_code} - {it.item_name}
                                    </div>
                                ))}
                                {req.items?.length > 2 && <div className="text-[9px] text-slate-400">+{req.items.length - 2} more...</div>}
                            </div>
                        </td>
                        <td className="font-black text-slate-700">{req.total_qty}</td>
                        <td className="text-[11px] text-slate-500">{req.transaction_date && format(new Date(req.transaction_date), 'dd MMM yyyy')}</td>
                        <td>
                           <button 
                             className="so-btn-secondary w-full"
                             onClick={(e) => { e.stopPropagation(); window.location.href = `/#/interbranchrequest/${req.name}`; }}
                           >
                             Manage
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
  );
}

export default InterBranchTransferList;
