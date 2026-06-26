import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
const API_BASE = '/api/method/kyle_retail.retail_api.api';
import Swal from 'sweetalert2';
import { useSelector } from 'react-redux';

export const KpiCard = ({ title, value, icon: Icon, colorClass, trend }) => {
  return (
    <div className={`kpi-card ${colorClass}`}>
      <div className="kpi-icon-wrapper">
        <Icon size={24} />
      </div>
      <div className="kpi-content">
        <div className="kpi-title">{title}</div>
        <div className="kpi-value">{value}</div>
        {trend && (
          <div className={`kpi-trend ${trend > 0 ? 'positive' : 'negative'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
    </div>
  );
};

export const FilterBar = ({ 
  isAdmin, 
  branches, 
  selectedBranch, 
  setSelectedBranch, 
  startDate, 
  setStartDate,
  endDate,
  setEndDate
}) => {
  return (
    <div className="dashboard-filter-bar flex-wrap">
      {isAdmin ? (
        <>
          <div className="filter-group">
            <span className="filter-label">From:</span>
            <input 
              type="date"
              className="filter-select"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </div>
          
          <div className="filter-group">
            <span className="filter-label">To:</span>
            <input 
              type="date"
              className="filter-select"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </div>
        </>
      ) : (
        <div className="filter-group">
          <span className="filter-label">Date:</span>
          <input 
            type="date"
            className="filter-select"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setEndDate(e.target.value);
            }}
            onClick={(e) => e.target.showPicker && e.target.showPicker()}
          />
        </div>
      )}
    </div>
  );
};

export const SalesTrendChart = ({ data }) => {
  return (
    <div className="dashboard-chart-card">
      <h3 className="chart-title">Sales Trend</h3>
      <div className="chart-container" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              dy={10} 
              tickFormatter={(tickItem) => {
                try {
                  const date = new Date(tickItem);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch (e) {
                  return tickItem;
                }
              }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              dx={-10}
              tickFormatter={(val) => `AED ${parseFloat(val).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              formatter={(value) => [`AED ${parseFloat(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 'Sales']}
              labelFormatter={(label) => {
                try {
                  const date = new Date(label);
                  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                } catch (e) {
                  return label;
                }
              }}
            />
            <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const PurchaseTrendChart = ({ data }) => {
  return (
    <div className="dashboard-chart-card">
      <h3 className="chart-title">Purchase Trend</h3>
      <div className="chart-container" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              dy={10} 
              tickFormatter={(tickItem) => {
                try {
                  const date = new Date(tickItem);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch (e) {
                  return tickItem;
                }
              }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              dx={-10}
              tickFormatter={(val) => `AED ${parseFloat(val).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              formatter={(value) => [`AED ${parseFloat(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 'Purchases']}
              labelFormatter={(label) => {
                try {
                  const date = new Date(label);
                  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                } catch (e) {
                  return label;
                }
              }}
            />
            <Area type="monotone" dataKey="purchases" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorPurchases)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const ReceivablesPayablesChart = ({ data }) => {
  return (
    <div className="dashboard-chart-card">
      <h3 className="chart-title">Receivables vs Payables Trend</h3>
      <div className="chart-container" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              dy={10} 
              tickFormatter={(tickItem) => {
                try {
                  const date = new Date(tickItem);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch (e) {
                  return tickItem;
                }
              }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              dx={-10}
              tickFormatter={(val) => `AED ${parseFloat(val).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              formatter={(value, name) => [`AED ${parseFloat(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, name === 'receivables' ? 'RECEIVABLES' : 'PAYABLES']}
              labelFormatter={(label) => {
                try {
                  const date = new Date(label);
                  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                } catch (e) {
                  return label;
                }
              }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Bar dataKey="receivables" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Receivables" />
            <Bar dataKey="payables" fill="#ef4444" radius={[4, 4, 0, 0]} name="Payables" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const CustomerTrendChart = ({ data }) => {
  return (
    <div className="dashboard-chart-card">
      <h3 className="chart-title">Customer Registration Growth</h3>
      <div className="chart-container" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              dy={10} 
              tickFormatter={(tickItem) => {
                try {
                  const date = new Date(tickItem);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch (e) {
                  return tickItem;
                }
              }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              dx={-10}
              tickFormatter={(val) => parseInt(val)}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              formatter={(value) => [`${value} New Customers`, 'Growth']}
              labelFormatter={(label) => {
                try {
                  const date = new Date(label);
                  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                } catch (e) {
                  return label;
                }
              }}
            />
            <Bar dataKey="customers" fill="#10b981" radius={[4, 4, 0, 0]} name="Customers" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const StockDistributionChart = ({ data }) => {
  return (
    <div className="dashboard-chart-card">
      <h3 className="chart-title">Stock Valuation by Warehouse</h3>
      <div className="chart-container" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis 
              type="number"
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              tickFormatter={(val) => `AED ${parseFloat(val).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}
            />
            <YAxis 
              type="category"
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{fill: '#64748b', fontSize: 10}} 
              width={120}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              formatter={(value) => [`AED ${parseFloat(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 'Stock Value']}
            />
            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} name="Valuation" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const PendingOperationsChart = ({ data }) => {
  const COLORS = ['#f59e0b', '#3b82f6', '#10b981'];
  return (
    <div className="dashboard-chart-card">
      <h3 className="chart-title">Pending Tasks & Operations</h3>
      <div className="chart-container" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              formatter={(value, name, props) => [`${value} items/tasks`, props.payload.name]}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const ModeOfPaymentsChart = ({ data }) => {
  if (!data || data.length === 0) return null;
  return (
    <div className="dashboard-chart-card">
      <h3 className="chart-title">Mode of Payments Breakdown</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ 
            padding: '1.25rem 1rem', 
            background: '#f8fafc', 
            border: '1.5px solid #e2e8f0', 
            borderRadius: '0.75rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '0.5rem',
            transition: 'all 0.2s',
            cursor: 'default'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.name}</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
              <span style={{ fontSize: '0.85rem', marginRight: '0.2rem', color: '#94a3b8' }}>AED</span>
              {parseFloat(item.value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const EmployeeCheckinWidget = ({ employee: propEmployee }) => {
  const user = useSelector((state) => state.user.user);
  const employee = typeof propEmployee === 'string' ? propEmployee : (propEmployee?.employee_name || propEmployee?.name || user?.employee_name || user?.name || user);
  
  const [status, setStatus] = useState('UNKNOWN');
  const [lastTime, setLastTime] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}.get_employee_status`, {
        params: { employee }
      });
      if (res.data?.message?.status === 'success') {
        setStatus(res.data.message.data.current_status);
        setLastTime(res.data.message.data.last_time);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employee) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [employee]);

  const handleLog = async (log_type) => {
    try {
      Swal.fire({
        title: 'Processing...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      
      const res = await axios.post(`${API_BASE}.handle_employee_checkin`, {
        employee,
        log_type
      });
      
      if (res.data?.message?.status === 'success') {
        Swal.fire('Success', res.data.message.message, 'success');
        fetchStatus();
      } else {
        Swal.fire('Error', res.data?.message?.message || 'Failed to record log', 'error');
      }
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  if (!employee) return null;

  return (
    <div className="dashboard-chart-card flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100/50">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-3 rounded-2xl ${status === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
          <Clock size={28} />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800 m-0 leading-tight">Time & Attendance</h3>
          <p className="text-sm font-bold text-slate-500 m-0">
            {status === 'IN' ? 'Currently Checked In' : 'Currently Checked Out'}
          </p>
        </div>
      </div>
      
      {loading ? (
        <div className="animate-pulse flex space-x-4">
          <div className="h-10 w-24 bg-slate-200 rounded-xl"></div>
          <div className="h-10 w-24 bg-slate-200 rounded-xl"></div>
        </div>
      ) : (
        <div className="flex gap-4 w-full justify-center">
          <button 
            onClick={() => handleLog('IN')}
            disabled={status === 'IN'}
            className={`flex-1 max-w-[140px] py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              status === 'IN' 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 border-b-4 border-emerald-600 active:translate-y-1 active:border-b-0'
            }`}
          >
            <CheckCircle size={18} /> IN
          </button>
          
          <button 
            onClick={() => handleLog('OUT')}
            disabled={status !== 'IN'}
            className={`flex-1 max-w-[140px] py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              status !== 'IN' 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30 border-b-4 border-rose-600 active:translate-y-1 active:border-b-0'
            }`}
          >
            <AlertCircle size={18} /> OUT
          </button>
        </div>
      )}
      
      {lastTime && (
        <p className="text-xs font-semibold text-slate-400 mt-6 mb-0 text-center">
          Last log: {new Date(lastTime).toLocaleString()}
        </p>
      )}
    </div>
  );
};

export const DeadStockWidget = ({ selectedBranch }) => {
  const [deadStock, setDeadStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);

  const fetchDeadStock = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const fromDate = new Date(today.setDate(today.getDate() - days)).toISOString().split('T')[0];
      const res = await axios.get(`${API_BASE}.get_dead_stock`, {
        params: {
          warehouse: selectedBranch === 'All Branches' ? '' : selectedBranch,
          from_date: fromDate
        }
      });
      if (res.data?.message?.status === 'success') {
        setDeadStock(res.data.message.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeadStock();
  }, [selectedBranch, days]);

  return (
    <div className="dashboard-chart-card col-span-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="chart-title m-0">Dead Stock Report</h3>
        <select 
          className="filter-select text-sm p-2"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={15}>Last 15 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={60}>Last 60 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase">Item Code</th>
              <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase">Item Name</th>
              <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase">Warehouse</th>
              <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase text-right">Qty</th>
              <th className="py-3 px-4 text-xs font-black text-slate-400 uppercase text-right">Value (AED)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="py-8 text-center text-slate-400">Loading...</td></tr>
            ) : deadStock.length === 0 ? (
              <tr><td colSpan="5" className="py-8 text-center text-slate-400">No dead stock found for this period.</td></tr>
            ) : (
              deadStock.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-xs font-bold text-slate-600">{row.item_code}</td>
                  <td className="py-3 px-4 text-xs font-bold text-slate-800">{row.item_name}</td>
                  <td className="py-3 px-4 text-xs text-slate-500">{row.warehouse}</td>
                  <td className="py-3 px-4 text-xs font-black text-slate-800 text-right">{row.actual_qty}</td>
                  <td className="py-3 px-4 text-xs font-black text-rose-600 text-right">{parseFloat(row.stock_value || 0).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
