import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Plus, Filter, Building2, Package, Loader2, ArrowRightLeft, ArrowRight, ChevronRight, FileText, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { useLegacyTheme } from '../../hooks/useLegacyTheme';

const API_PATH = '/api/method/kyle_retail.retail_api.api';

function InterBranchTransferList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' or 'outgoing'
  
  const { themeColor, themeColorHover, themeLight, isGreen } = useLegacyTheme();
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

  return (
    <div className="so-page bg-[#fbfcfd] min-h-screen font-sans text-slate-900">
      
      {/* 1. PREMIUM HEADER */}
      <div className="so-page-header border-b border-slate-100 px-8 py-6 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="so-page-title flex items-center gap-3 text-2xl font-black text-slate-800 tracking-tight">
            <ArrowRightLeft size={24} style={{ color: themeColor }} />
            Stock Transfer Requests
          </h1>
          <p className="so-page-subtitle text-slate-400 text-xs font-medium">Manage and audit material transfer requests across branches</p>
        </div>
        <div>
          <a 
            href="/#/newinterbranchrequest" 
            className="so-btn-primary flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all"
            style={{ 
              background: themeColor, 
              borderColor: themeColor, 
              textDecoration: 'none', 
              boxShadow: `0 4px 12px ${themeColor}20` 
            }}
          >
            <Plus size={16} /> New Request
          </a>
        </div>
      </div>

      {/* 2. TAB CONTROLS WITH GLOWING ACTIVE BAR */}
      <div className="px-8 border-b border-slate-100 bg-white flex gap-8">
        <button 
          onClick={() => setActiveTab('incoming')}
          className={`py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'incoming' ? `text-[${themeColor}]` : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          style={activeTab === 'incoming' ? { borderColor: themeColor, color: themeColor } : {}}
        >
          Incoming Requests (To {warehouse?.replace(' - KSPL', '') || 'Branch'})
        </button>
        <button 
          onClick={() => setActiveTab('outgoing')}
          className={`py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'outgoing' ? `text-[${themeColor}]` : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          style={activeTab === 'outgoing' ? { borderColor: themeColor, color: themeColor } : {}}
        >
          My Outbound Requests
        </button>
      </div>

      {/* 3. TABLE CONTAINER WITH GLASSMORPHISM CARD */}
      <div style={{ padding: '2rem' }}>
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_4px_16px_rgba(15,23,42,0.02)] overflow-hidden">
          <div className="so-table-wrapper scrollable-table-area overflow-x-auto">
            <table className="so-table w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Request ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {activeTab === 'incoming' ? 'Requesting Branch' : 'Target Branch'}
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Items Requested</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Total Qty</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Date Requested</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400" style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-24 text-center">
                      <Loader2 className="animate-spin mx-auto text-blue-500 mb-2" size={32} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loading branch requests...</span>
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="so-empty py-20 text-center flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                          <Package size={32} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">No Branch Transfers Found</p>
                          <p className="text-xs text-slate-400">No transfer requests have been logged in this direction</p>
                        </div>
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => {
                    const style = getStatusStyle(req.status);
                    return (
                      <tr 
                        key={req.name} 
                        onClick={() => window.location.href = `/#/interbranchrequest/${req.name}`} 
                        className="hover:bg-slate-50/50 cursor-pointer border-b border-slate-50 transition-all"
                      >
                        {/* 1. Request ID */}
                        <td className="px-6 py-4 font-black" style={{ color: themeColor }}>
                          {req.name}
                        </td>
                        
                        {/* 2. Directional Branch */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-slate-300" />
                            <span className="font-bold text-sm text-slate-700">
                              {activeTab === 'incoming' ? req.target_warehouse?.replace(' - KSPL', '') : req.set_from_warehouse?.replace(' - KSPL', '')}
                            </span>
                          </div>
                        </td>
                        
                        {/* 3. Status Badge */}
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border" style={{
                            backgroundColor: style.bg, color: style.text, borderColor: style.border
                          }}>
                            {req.status}
                          </span>
                        </td>
                        
                        {/* 4. Items Details */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {req.items?.slice(0, 2).map((it, idx) => (
                              <div key={idx} className="text-[11px] font-bold text-slate-600 truncate max-w-[240px] flex items-center gap-1.5">
                                <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-mono">{it.item_code}</span>
                                <span className="truncate">{it.item_name}</span>
                              </div>
                            ))}
                            {req.items?.length > 2 && (
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider ml-1 mt-0.5">
                                +{req.items.length - 2} more product(s)
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* 5. Quantity */}
                        <td className="px-6 py-4 text-center font-black text-slate-700 text-sm">
                          {req.total_qty}
                        </td>
                        
                        {/* 6. Date */}
                        <td className="px-6 py-4 text-right text-[11px] font-semibold text-slate-500">
                          {req.transaction_date && format(new Date(req.transaction_date), 'dd MMM yyyy')}
                        </td>
                        
                        {/* 7. Manage Action */}
                        <td className="px-6 py-4 text-center">
                           <button 
                             className="so-btn-secondary px-4 py-2 text-[10px] font-bold uppercase tracking-widest w-full hover:bg-slate-50 transition-all flex items-center justify-center gap-1"
                             onClick={(e) => { e.stopPropagation(); window.location.href = `/#/interbranchrequest/${req.name}`; }}
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
  );
}

export default InterBranchTransferList;
