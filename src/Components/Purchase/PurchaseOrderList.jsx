import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Search, Calendar, Filter, Plus, FileText, ChevronRight,
  Loader2, ShoppingCart, ArrowRightLeft, Clock, History,
  CheckCircle2, AlertCircle, Eye, Printer, Trash2, Edit2
} from 'lucide-react';
import './Purchase.css';
import '../Headers/LegacyPOS.css';

const PurchaseOrderList = ({ onNew }) => {
  const theme = useSelector((state) => state.user.theme);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [error, setError] = useState(null);

  const getSession = () => localStorage.getItem('session') || '';
  const BASE_URL = '';
  const API_PATH = `/api/method/kyle_retail.retail_api.api`;

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

  return (
    <div className={`font-sans purchase-list-container ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
      {/* HEADER SECTION */}
      <div className="bg-white px-8 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">Purchase Directory</h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-widest">
            Manage your procurement workflow
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Quick Search (e.g. PO-001 or Supplier)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 w-[280px] focus:bg-white focus:border-emerald-500 transition-all outline-none"
            />
          </div>

          <button
            onClick={onNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create New PO
          </button>
        </div>
      </div>

      <div className="max-w-[1700px] mx-auto p-8">
        {/* FILTER BAR */}
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex gap-2">
            {['All', 'Draft', 'Submitted', 'Partially Received', 'Completed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${filterStatus === tab
                  ? 'bg-emerald-50 text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <Filter className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Advanced Filtering</span>
          </div>
        </div>

        {/* DATA GRID */}
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-emerald-50 border-t-emerald-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-emerald-600/30" />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Processing Directory...</p>
            </div>
          ) : error ? (
            <div className="py-24 text-center">
              <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{error}</h3>
              <button onClick={fetchOrders} className="mt-4 text-xs font-bold text-emerald-600 hover:underline">Retry</button>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-32 text-center">
              <div className="mx-auto w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-6">
                <FileText className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">No Transactions Found</h3>
              <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto mt-2">
                We couldn't find any purchase orders matching your current filter criteria.
              </p>
              <button onClick={onNew} className="mt-8 bg-emerald-600 text-white px-8 py-3 rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 transition-all uppercase tracking-widest">
                Start New Purchase
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Identity #</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Supplier & Location</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Posting Matrix</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Analytics</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-right">Commitment Value</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {orders.map((po) => (
                    <tr key={po.name} className="group hover:bg-emerald-50/30 transition-all duration-200">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all shadow-sm">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-extrabold text-slate-800">{po.name}</div>
                            {po.set_warehouse && (
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-300" />
                                {po.set_warehouse}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-[13px] font-bold text-slate-700 leading-snug">{po.supplier_name || po.supplier}</div>
                        <div className="text-[10px] font-bold text-[#003d7c] mt-1 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                          ID: {po.supplier}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(po.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                          </div>
                          {po.schedule_date && (
                            <div className="text-[10px] font-bold text-emerald-600 uppercase">
                              Due: {new Date(po.schedule_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-bold text-slate-800">{parseFloat(po.total_qty || 0).toFixed(0)}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Products</div>
                          </div>
                          <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (po.total_qty / 100) * 100)}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">NET AMOUNT</div>
                        <div className="text-sm font-black text-slate-900 tabular-nums">
                          <span className="text-[10px] text-slate-400 mr-1 font-bold">AED</span>
                          {parseFloat(po.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {getStatusBadge(po.status)}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-white hover:shadow-md rounded-lg text-slate-400 hover:text-emerald-600 transition-all">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:bg-white hover:shadow-md rounded-lg text-slate-400 hover:text-blue-600 transition-all">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button className="p-2 hover:bg-white hover:shadow-md rounded-lg text-slate-400 hover:text-indigo-600 transition-all">
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderList;
