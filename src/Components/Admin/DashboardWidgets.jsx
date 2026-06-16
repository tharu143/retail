import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';

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

          <div className="filter-group ml-auto">
            <span className="filter-label">Branch:</span>
            <select 
              className="filter-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="All Branches">All Branches</option>
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
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
