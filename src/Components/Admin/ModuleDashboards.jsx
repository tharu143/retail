import React from 'react';
import { KpiCard, FilterBar, DeadStockWidget } from './DashboardWidgets';
import { ShoppingCart, TrendingUp, Boxes, Monitor, ArrowRightLeft } from 'lucide-react';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const BranchGrid = ({ branches, renderBranch }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
      {branches.map(b => (
        <div key={b.name} style={{ background: '#fff', borderRadius: '1.5rem', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>
            {b.name}
          </h3>
          {renderBranch(b)}
        </div>
      ))}
    </div>
  );
};

export const ProcurementDashboard = ({ branchMetrics, startDate, setStartDate, endDate, setEndDate, isAdmin, branches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Procurement Overview</h1>
          <p>Monitor supplier performance and purchase volumes across all branches.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />
      
      <BranchGrid branches={branches} renderBranch={(b) => {
        const metrics = branchMetrics?.[b.name]?.metrics || {};
        return (
          <div className="dashboard-metrics-grid" style={{ gridTemplateColumns: '1fr' }}>
            <KpiCard title="Total Purchases" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={20} /> {metrics.purchases || 0}</span>} icon={ShoppingCart} colorClass="icon-purchase" />
            <KpiCard title="Pending POs" value={metrics.pending_pos || 0} icon={ShoppingCart} colorClass="icon-pos" />
          </div>
        )
      }} />
    </div>
  </div>
);

export const SalesReturnsDashboard = ({ branchMetrics, startDate, setStartDate, endDate, setEndDate, isAdmin, branches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Sales & Returns Overview</h1>
          <p>Track revenue and customer return rates across all branches.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />
      
      <BranchGrid branches={branches} renderBranch={(b) => {
        const metrics = branchMetrics?.[b.name]?.metrics || {};
        const charts = branchMetrics?.[b.name]?.charts || {};
        return (
          <>
            <div className="dashboard-metrics-grid" style={{ gridTemplateColumns: '1fr' }}>
              <KpiCard title="Total Sales" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={20} /> {metrics.sales || 0}</span>} icon={TrendingUp} colorClass="icon-sales" />
              <KpiCard title="Total Returns" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={20} /> {metrics.returns_amount || 0}</span>} icon={ArrowRightLeft} colorClass="icon-reports" />
              <KpiCard title="Return Rate" value={`${metrics.return_rate || 0}%`} icon={ArrowRightLeft} colorClass="icon-reports" />
            </div>
            {isAdmin && charts.sales_vs_returns && charts.sales_vs_returns.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ fontSize: '14px', color: '#64748b', fontWeight: 700, marginBottom: '1rem' }}>Sales vs Returns</h4>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.sales_vs_returns}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dx={-10} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )
      }} />
    </div>
  </div>
);

export const StockManagementDashboard = ({ branchMetrics, startDate, setStartDate, endDate, setEndDate, isAdmin, branches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Stock Management Overview</h1>
          <p>Live inventory valuation and alerts.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />
      
      <BranchGrid branches={branches} renderBranch={(b) => {
        const metrics = branchMetrics?.[b.name]?.metrics || {};
        return (
          <>
            <div className="dashboard-metrics-grid mb-6" style={{ gridTemplateColumns: '1fr' }}>
              <KpiCard title="Stock Value" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={20} /> {metrics.stock_value || 0}</span>} icon={Boxes} colorClass="icon-items" />
              <KpiCard title="Low Stock Items" value={metrics.low_stock_items || 0} icon={Boxes} colorClass="icon-reports" />
            </div>
            <div className="mt-6">
              <DeadStockWidget selectedBranch={b.name} />
            </div>
          </>
        )
      }} />
    </div>
  </div>
);

export const POSOperationsDashboard = ({ branchMetrics, startDate, setStartDate, endDate, setEndDate, isAdmin, branches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>POS Operations Overview</h1>
          <p>Cashier performance and shift metrics across branches.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />
      
      <BranchGrid branches={branches} renderBranch={(b) => {
        const metrics = branchMetrics?.[b.name]?.metrics || {};
        return (
          <div className="dashboard-metrics-grid" style={{ gridTemplateColumns: '1fr' }}>
            <KpiCard title="Active Registers" value={metrics.active_registers || 0} icon={Monitor} colorClass="icon-pos" />
            <KpiCard title="Today's Receipts" value={metrics.todays_receipts || 0} icon={Monitor} colorClass="icon-sales" />
          </div>
        )
      }} />
    </div>
  </div>
);

export const InventoryLogisticsDashboard = ({ branchMetrics, startDate, setStartDate, endDate, setEndDate, isAdmin, branches }) => (
  <div className="dashboard-modern-container">
    <div className="max-w-7xl mx-auto">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Inventory Logistics</h1>
          <p>Inter-branch transfers and dispatch.</p>
        </div>
      </header>
      <FilterBar startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />
      
      <BranchGrid branches={branches} renderBranch={(b) => {
        const metrics = branchMetrics?.[b.name]?.metrics || {};
        return (
          <div className="dashboard-metrics-grid" style={{ gridTemplateColumns: '1fr' }}>
            <KpiCard title="Pending Transfers" value={metrics.pending_transfers || 0} icon={ArrowRightLeft} colorClass="icon-purchase" />
            <KpiCard title="Dispatched Transfers" value={metrics.dispatched_transfers || 0} icon={ArrowRightLeft} colorClass="icon-items" />
          </div>
        )
      }} />
    </div>
  </div>
);
