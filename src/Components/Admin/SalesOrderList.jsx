import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, X, Package, ChevronLeft,
  Settings, AlertCircle, Trash2, Edit2,
  ChevronDown, Palette, Loader2, ChevronRight,
  ShoppingCart, Receipt, CreditCard, Tag, User,
  Calendar, Layers, Filter, FileText, CheckCircle2, Clock
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/* ==================== UI HELPERS ==================== */
const StatusBadge = ({ docstatus, themeColor }) => {
  const isSubmitted = docstatus === 1;
  return (
    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5 w-fit" style={{
      backgroundColor: isSubmitted ? '#dcfce7' : '#fef3c7',
      color: isSubmitted ? '#166534' : '#92400e',
      border: `1px solid ${isSubmitted ? '#bbf7d0' : '#fde68a'}`
    }}>
      <div className={`w-1 h-1 rounded-full ${isSubmitted ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {isSubmitted ? 'Submitted' : 'Draft'}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, color, trend }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 rounded-2xl transition-colors" style={{ backgroundColor: `${color}10` }}>
        <Icon size={20} style={{ color }} />
      </div>
      {trend && (
        <span className={`text-[10px] font-black ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'} bg-gray-50 px-2 py-1 rounded-lg`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1">{label}</p>
    <h4 className="text-2xl font-black text-gray-900 tracking-tight">{value}</h4>
  </div>
);

export default function SalesOrderList() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Theme logic
  const [legacySubTheme] = useState(localStorage.getItem('legacySubTheme') || 'green');
  const themeColor = legacySubTheme === 'green' ? '#10b981' : '#0ea5e9';

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/resource/Sales Order', {
        params: {
          limit_page_length: 2000,
          fields: JSON.stringify(['name', 'customer', 'customer_name', 'transaction_date', 'grand_total', 'docstatus', 'status', 'total_qty', 'base_total']),
          order_by: 'modified desc'
        },
        withCredentials: true
      });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error(err);
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

  const handleRowClick = (name) => {
    navigate(`/salesorder-details/${name}`);
  };

  return (
    <>
      <div className="min-h-screen bg-[#f8fafc] pb-20 pt-8 px-6 lg:px-12">
        
        {/* Header Section */}
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                <ShoppingCart size={18} className="text-white" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Sales Orders</h1>
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1">
              Order Orchestration & Fulfillment
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                type="text"
                placeholder="Search by Order ID or Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-80 pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/30 transition-all shadow-sm"
              />
            </div>
            <button 
                onClick={() => navigate('/salesorder/create')}
                className="px-6 py-3 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-black hover:-translate-y-0.5 transition-all shadow-lg active:scale-95 shrink-0"
            >
              <Plus size={16} /> New Order
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard label="Total Orders" value={stats.total} icon={Layers} color="#6366f1" />
          <StatCard label="Submitted" value={stats.submitted} icon={CheckCircle2} color="#10b981" />
          <StatCard label="Drafts" value={stats.drafts} icon={Clock} color="#f59e0b" />
          <StatCard label="Net Revenue" value={`AED ${stats.totalValue.toLocaleString()}`} icon={CreditCard} color="#0ea5e9" />
        </div>

        {/* Table Container */}
        <div className="max-w-7xl mx-auto bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-50">
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Order Identifier</th>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Partner Entity</th>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Order Date</th>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Authorized Value</th>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Lifecycle Status</th>
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 size={40} className="animate-spin text-blue-600" />
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Hydrating Orders...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-20 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">
                      No matching sales orders found
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr 
                      key={order.name}
                      onClick={() => handleRowClick(order.name)}
                      className="hover:bg-gray-50/80 transition-all cursor-pointer group"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs shadow-sm">
                            SO
                          </div>
                          <div>
                            <div className="text-sm font-black text-gray-900 tracking-tight group-hover:text-blue-600 transition-colors">
                              {order.name}
                            </div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              Series: {order.naming_series || 'SAL-ORD'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <User size={14} className="text-gray-400" />
                           <span className="text-sm font-bold text-gray-700">{order.customer_name || order.customer}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <Calendar size={14} className="text-gray-400" />
                           <span className="text-sm font-bold text-gray-700">{order.transaction_date}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-black text-gray-900 tracking-tight">
                          AED {parseFloat(order.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Items: {order.total_qty || 0}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <StatusBadge docstatus={order.docstatus} themeColor={themeColor} />
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-300 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
                            <ArrowRight size={20} />
                          </div>
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
    </>
  );
}

const ArrowRight = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14m-7-7 7 7-7 7" />
  </svg>
);
