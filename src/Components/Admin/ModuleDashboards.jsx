import React from 'react';
import { KpiCard, FilterBar, SalesTrendChart } from './DashboardWidgets';
import { ShoppingCart, TrendingUp, Boxes, Monitor, ArrowRightLeft } from 'lucide-react';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const ProcurementDashboard = ({ metrics, charts, startDate, setStartDate, endDate, setEndDate, selectedBranch, setSelectedBranch, isAdmin, mockBranches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Procurement Overview</h1>
          <p>Monitor supplier performance and purchase volumes.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={mockBranches} />
      <div className="dashboard-metrics-grid">
        <KpiCard title="Total Purchases" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={20} /> {metrics?.purchases || 0}</span>} icon={ShoppingCart} colorClass="icon-purchase" />
        <KpiCard title="Pending POs" value={metrics?.pending_pos || 0} icon={ShoppingCart} colorClass="icon-pos" />
      </div>
    </div>
  </div>
);

export const SalesReturnsDashboard = ({ metrics, charts, startDate, setStartDate, endDate, setEndDate, selectedBranch, setSelectedBranch, isAdmin, mockBranches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Sales & Returns Overview</h1>
          <p>Track revenue and customer return rates.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={mockBranches} />
      <div className="dashboard-metrics-grid">
        <KpiCard title="Total Sales" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={20} /> {metrics?.sales || 0}</span>} icon={TrendingUp} colorClass="icon-sales" />
        <KpiCard title="Total Returns" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={20} /> {metrics?.returns_amount || 0}</span>} icon={ArrowRightLeft} colorClass="icon-reports" />
        <KpiCard title="Return Rate" value={`${metrics?.return_rate || 0}%`} icon={ArrowRightLeft} colorClass="icon-reports" />
      </div>
      <div style={{ marginTop: '2rem' }}>
        <h3 className="chart-title">Sales vs Returns</h3>
        <div className="dashboard-chart-card">
          <div className="chart-container" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.sales_vs_returns || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const StockManagementDashboard = ({ metrics, charts, startDate, setStartDate, endDate, setEndDate, selectedBranch, setSelectedBranch, isAdmin, mockBranches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Stock Management Overview</h1>
          <p>Live inventory valuation and alerts.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={mockBranches} />
      <div className="dashboard-metrics-grid">
        <KpiCard title="Stock Value" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={20} /> {metrics?.stock_value || 0}</span>} icon={Boxes} colorClass="icon-items" />
        <KpiCard title="Low Stock Items" value={metrics?.low_stock_items || 0} icon={Boxes} colorClass="icon-reports" />
      </div>
    </div>
  </div>
);

export const POSOperationsDashboard = ({ metrics, charts, startDate, setStartDate, endDate, setEndDate, selectedBranch, setSelectedBranch, isAdmin, mockBranches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>POS Operations Overview</h1>
          <p>Cashier performance and shift metrics.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={mockBranches} />
      <div className="dashboard-metrics-grid">
        <KpiCard title="Active Registers" value={metrics?.active_registers || 0} icon={Monitor} colorClass="icon-pos" />
        <KpiCard title="Today's Receipts" value={metrics?.todays_receipts || 0} icon={Monitor} colorClass="icon-sales" />
      </div>
    </div>
  </div>
);

export const InventoryLogisticsDashboard = ({ metrics, charts, startDate, setStartDate, endDate, setEndDate, selectedBranch, setSelectedBranch, isAdmin, mockBranches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Inventory Logistics</h1>
          <p>Inter-branch transfers and dispatch.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={mockBranches} />
      <div className="dashboard-metrics-grid">
        <KpiCard title="Pending Transfers" value={metrics?.pending_transfers || 0} icon={ArrowRightLeft} colorClass="icon-purchase" />
        <KpiCard title="Dispatched Transfers" value={metrics?.dispatched_transfers || 0} icon={ArrowRightLeft} colorClass="icon-items" />
      </div>
    </div>
  </div>
);
