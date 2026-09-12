import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { KpiCard, FilterBar, SalesTrendChart, PurchaseTrendChart, ReceivablesPayablesChart, CustomerTrendChart, StockDistributionChart, PendingOperationsChart, ModeOfPaymentsChart, EmployeeCheckinWidget } from './DashboardWidgets';
import { getDashboardMetrics } from '../../utils/dashboardService';
import { authFetchBase } from '../../utils/authFetch';
import {
  ArrowRight,
  ShoppingCart,
  Users,
  BarChart3,
  Boxes,
  Monitor,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  PackageCheck,
  Receipt,
  Truck,
  FileText,
  ArrowRightLeft,
  ClipboardList,
  PieChart as LucidePieChart,
  LayoutDashboard,
  Tag,
  Layers,
  Lock,
  Settings as SettingsIcon,
  UserCheck,
  PlusCircle,
  Activity,
  RotateCcw,
  Home,
  Sun,
  Moon,
  Bell,
  Clock
} from 'lucide-react';

// Relative Imports for Right Panel Dynamic Loading
import SupplierList from './SupplierList';
import PurchaseOrder from '../Purchase/PurchaseOrder';
import PurchaseOrderLists from './PurchaseOrderLists';
import PurchaseReceiptList from './PurchaseReceiptList';
import PurchaseInvoiceList from './PurchaseInvoiceList';
import PurchaseReturnList from './PurchaseReturnList';
import CustomerList from './CustomerList';
import SalesOrderList from './SalesOrderList';
import SalesInvoiceList from './SalesInvoiceList';
import DeliveryNoteList from './DeliveryNoteList';
import SalesReturnList from './SalesReturnList';
import ItemList from './ItemList';
import ItemGroupList from './ItemGroupList';
import ItemPriceList from './ItemPriceList';
import ProductBundleList from './ProductBundleList';
import StockEntryList from './StockEntryList';
import StockBalanceReport from '../Reports/StockBalanceReport';
import StockLedgerReport from '../Reports/StockLedgerReport';
import PosProfileList from './PosProfileList';
import PosOpeningentryList from './PosOpeningentryList';
import PosClosingEntryList from './PosClosingEntryList';
import ClosingEntry from '../OpeningEntry/ClosingEntry';
import ClosingCollection from '../Collection/ClosingCollection';
import InvoiceList from '../Headers/InvoiceList';
import InterBranchTransferList from './InterBranchTransferList';
import InterBranchTransferDetails from './InterBranchTransferDetails';
import DailySalesReport from '../Reports/DailySalesReport';
import SalesReport from '../Reports/SalesReport';
import PurchaseReport from '../Reports/PurchaseReport';
import ItemwiseSalesReport from '../Reports/ItemwiseSalesReport';
import GeneralLedgerReport from '../Reports/GeneralLedgerReport';
import POSHealth from './POSHealth';
import Settings from './Settings';
import SyncManager from './SyncManager';
import Sidebar from '../Nav/Sidebar';
import DocumentationPage from './DocumentationPage';

import {
  ProcurementDashboard,
  SalesReturnsDashboard,
  StockManagementDashboard,
  POSOperationsDashboard,
  InventoryLogisticsDashboard
} from './ModuleDashboards';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

import './DashBoard.css';

const routeMap = {
  // Purchase
  'Supplier': { icon: Users },
  'New Purchase Order': { icon: ClipboardList },
  'Purchase Order List': { icon: FileText },
  'Purchase Receipt': { icon: Truck },
  'Purchase Invoice': { icon: Receipt },
  'Purchase Return': { icon: ArrowRightLeft },

  // Sales
  'Customer': { icon: UserCheck },
  'Sales Order': { icon: PackageCheck },
  'Sales Invoice': { icon: Receipt },
  'Delivery Note': { icon: Truck },
  'Sales Return': { icon: RotateCcw },

  // Stock
  'Item List': { icon: Boxes },
  'Price List': { icon: Tag },
  'Item Group': { icon: Layers },
  'Stock Entry': { icon: Activity },
  'Stock Balance Report': { icon: FileText },
  'Stock Ledger Report': { icon: FileText },

  // POS
  'POS Profile': { icon: LayoutDashboard },
  'Opening Entry': { icon: Lock },
  'Closing Entry List': { icon: FileText },
  'New Closing Entry': { icon: Monitor },
  'Closing Collection': { icon: Receipt },
  'POS Invoices': { icon: Receipt },

  'Inter-Branch Requests': { icon: ArrowRightLeft },
  'New Transfer Request': { icon: PlusCircle },

  // Reports
  'Daily Sales Report': { icon: BarChart3 },
  'Sales Summary Report': { icon: FileText },
  'Purchase Report': { icon: TrendingUp },
  'Item Wise Report': { icon: PieChart },
  'General Ledger': { icon: Receipt },

  // System
  'POS Health': { icon: TrendingUp },
  'Settings': { icon: SettingsIcon },
  'Sync Manager': { icon: ClipboardList },
  'Documentation': { icon: FileText },
};

function Dashboard() {
  const { user, warehouse, user_roles } = useSelector(state => state.user || {});

  // Navigation State
  const [activeItem, setActiveItem] = useState(() => {
    return localStorage.getItem('dashboardActiveItem') || 'home';
  });

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    localStorage.setItem('dashboardActiveItem', activeItem);
    // Clear URL query parameters when switching tabs to prevent state leakage (e.g. ?name=new)
    if (searchParams.toString() !== "") {
      setSearchParams({}, { replace: true });
    }
  }, [activeItem]);

  // Dashboard Theme State (dark / light)
  const [dashboardTheme, setDashboardTheme] = useState(() => {
    return localStorage.getItem('dashboardTheme') || 'dark';
  });

  // Dashboard Global State
  const [metrics, setMetrics] = useState(null);

  const todayObj = new Date();
  const todayDate = todayObj.toISOString().split('T')[0];
  const firstDayObj = new Date(todayObj.getFullYear(), todayObj.getMonth(), 1);
  const firstDayOfMonth = new Date(firstDayObj.getTime() - (firstDayObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayDate);

  const [selectedBranch, setSelectedBranch] = useState(warehouse || "All Branches");
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);

  // Role detection and branches for now (In real app, fetch from Redux/API)
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  useEffect(() => {
    if (!isAdmin) {
      setStartDate(todayDate);
      setEndDate(todayDate);
    } else {
      setStartDate(firstDayOfMonth);
      setEndDate(todayDate);
    }
  }, [isAdmin, todayDate, firstDayOfMonth]);

  useEffect(() => {
    if (isAdmin) {
      const fetchWarehouses = async () => {
        try {
          const res = await authFetchBase('custom_retailpos.custom_retailpos.retail_api.retail.get_company_warehouses');
          if (res.ok) {
            const json = await res.json();
            const list = json.message || json.data || [];
            const excluded = ['all warehouse', 'finished good', 'store', 'wrprocess', 'good transit', 'work in progress'];
            const valid = list.filter(w => !excluded.some(ex => w.name.toLowerCase().includes(ex)));
            setBranches(valid.map(w => ({ name: w.name })));
          } else {
            setBranches([{ name: warehouse || 'Default Warehouse' }]);
          }
        } catch (err) {
          console.error("Failed to fetch warehouses:", err);
          setBranches([{ name: warehouse || 'Default Warehouse' }]);
        }
      };
      fetchWarehouses();
    } else {
      setBranches([{ name: warehouse || 'Default Warehouse' }]);
      setSelectedBranch(warehouse || 'Default Warehouse');
    }
  }, [isAdmin, warehouse]);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (branches.length === 0) return;
      setLoading(true);

      try {
        const branchMetrics = {};
        const fetchPromises = branches.map(async (b) => {
          const data = await getDashboardMetrics(b.name, startDate, endDate);
          let parsedData = data;
          if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch (e) { }
          }
          let current = parsedData;
          while (current && current.message) current = current.message;
          branchMetrics[b.name] = current && current.metrics ? current : { metrics: {}, charts: {} };
        });

        const globalPromise = (async () => {
          const data = await getDashboardMetrics('All Branches', startDate, endDate);
          let parsedData = data;
          if (typeof data === 'string') {
            try { parsedData = JSON.parse(data); } catch (e) { }
          }
          let current = parsedData;
          while (current && current.message) current = current.message;
          branchMetrics['___GLOBAL___'] = current && current.metrics ? current : { metrics: {}, charts: {} };
        })();

        await Promise.all([...fetchPromises, globalPromise]);
        setMetrics(branchMetrics);
      } catch (err) {
        console.error("Failed to fetch multi-branch metrics:", err);
      }
      setLoading(false);
    };
    fetchMetrics();
  }, [branches, startDate, endDate]);

  const sections = [
    {
      title: 'Procurement',
      icon: ShoppingCart,
      colorClass: 'icon-purchase',
      cardClass: 'card-purchase',
      items: ['Supplier', 'Purchase Order List', 'Purchase Receipt', 'Purchase Invoice', 'Purchase Return'],
    },
    {
      title: 'Sales & Returns',
      icon: TrendingUp,
      colorClass: 'icon-sales',
      cardClass: 'card-sales',
      items: ['Customer', 'Sales Order', 'Sales Invoice', 'Delivery Note', 'Sales Return'],
    },
    {
      title: 'Stock Management',
      icon: Boxes,
      colorClass: 'icon-items',
      cardClass: 'card-items',
      items: ['Item List', 'Item Group', 'Price List', 'Stock Entry', 'Stock Balance Report', 'Stock Ledger Report'],
    },
    {
      title: 'POS Operations',
      icon: Monitor,
      colorClass: 'icon-pos',
      cardClass: 'card-pos',
      items: ['POS Profile', 'Opening Entry', 'Closing Entry List', 'Closing Collection'],
    },
    {
      title: 'Reports',
      icon: BarChart3,
      colorClass: 'icon-reports',
      cardClass: 'card-reports',
      items: ['Daily Sales Report', 'Sales Summary Report', 'Purchase Report', 'Item Wise Report', 'General Ledger'],
    },
    {
      title: 'Inventory Logistics',
      icon: ArrowRightLeft,
      colorClass: 'icon-items',
      cardClass: 'card-items',
      items: ['Inter-Branch Requests', 'New Transfer Request'],
    },
    {
      title: 'Administration',
      icon: SettingsIcon,
      colorClass: 'icon-pos',
      cardClass: 'card-pos',
      items: ['POS Health', 'Settings', 'Sync Manager', 'Documentation'],
    },
  ];

  // Dynamic Content Component Loader
  const renderContent = () => {
    switch (activeItem) {
      case 'Supplier':
        return <SupplierList />;
      case 'New Purchase Order':
        return <PurchaseOrder />;
      case 'Purchase Order List':
        return <PurchaseOrderLists />;
      case 'Purchase Receipt':
        return <PurchaseReceiptList />;
      case 'Purchase Invoice':
        return <PurchaseInvoiceList />;
      case 'Purchase Return':
        return <PurchaseReturnList />;
      case 'Customer':
        return <CustomerList />;
      case 'Sales Order':
        return <SalesOrderList />;
      case 'Sales Invoice':
        return <SalesInvoiceList />;
      case 'Delivery Note':
        return <DeliveryNoteList />;
      case 'Sales Return':
        return <SalesReturnList />;
      case 'Item List':
        return <ItemList />;
      case 'Price List':
        return <ItemPriceList />;
      case 'Item Group':
        return <ItemGroupList />;
      case 'Product Bundles':
        return <ProductBundleList />;
      case 'Stock Entry':
        return <StockEntryList />;
      case 'Stock Balance Report':
        return <StockBalanceReport />;
      case 'Stock Ledger Report':
        return <StockLedgerReport />;
      case 'POS Profile':
        return <PosProfileList />;
      case 'Opening Entry':
        return <PosOpeningentryList />;
      case 'Closing Entry List':
        return <PosClosingEntryList />;
      case 'New Closing Entry':
        return <ClosingEntry />;
      case 'Closing Collection':
      case 'Cash Collection':
        return <ClosingCollection />;
      case 'POS Invoices':
        return <InvoiceList />;
      case 'Inter-Branch Requests':
        return <InterBranchTransferList />;
      case 'New Transfer Request':
        return <InterBranchTransferDetails />;
      case 'Daily Sales Report':
        return <DailySalesReport />;
      case 'Sales Summary Report':
        return <SalesReport />;
      case 'Purchase Report':
        return <PurchaseReport />;
      case 'Item Wise Report':
        return <ItemwiseSalesReport />;
      case 'General Ledger':
        return <GeneralLedgerReport />;
      case 'POS Health':
        return <POSHealth />;
      case 'Settings':
        return <Settings />;
      case 'Sync Manager':
        return <SyncManager />;
      case 'Documentation':
        return <DocumentationPage />;
      case 'Procurement':
        return <ProcurementDashboard branchMetrics={metrics} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />;
      case 'Sales & Returns':
        return <SalesReturnsDashboard branchMetrics={metrics} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />;
      case 'Stock Management':
        return <StockManagementDashboard branchMetrics={metrics} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />;
      case 'POS Operations':
        return <POSOperationsDashboard branchMetrics={metrics} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />;
      case 'Inventory Logistics':
        return <InventoryLogisticsDashboard branchMetrics={metrics} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} isAdmin={isAdmin} branches={branches} />;
      case 'home':
      default:
        return (
          <DashboardHome 
            user={user} 
            sections={sections} 
            setActiveItem={setActiveItem} 
            allMetrics={metrics} 
            loading={loading} 
            startDate={startDate} 
            setStartDate={setStartDate} 
            endDate={endDate} 
            setEndDate={setEndDate} 
            isAdmin={isAdmin} 
            branches={branches} 
            selectedBranch={selectedBranch} 
            setSelectedBranch={setSelectedBranch} 
            dashboardTheme={dashboardTheme}
            setDashboardTheme={setDashboardTheme}
          />
        );
    }
  };

  return (
    <div className="dashboard-layout-wrapper">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        isStandalone={false}
      />

      {/* Right Dynamic Content Panel */}
      <main className={`right-content-panel ${dashboardTheme === 'dark' ? 'dark' : ''}`}>
        {renderContent()}
      </main>
    </div>
  );
}

// Inner Component for Dashboard Homepage
function DashboardHome({ user, sections, setActiveItem, allMetrics, loading, startDate, setStartDate, endDate, setEndDate, isAdmin, branches, selectedBranch, setSelectedBranch, dashboardTheme, setDashboardTheme }) {
  const activeBranchKey = isAdmin ? selectedBranch : (branches[0]?.name || '___GLOBAL___');
  const activeMetrics = allMetrics?.[activeBranchKey] || allMetrics?.['___GLOBAL___'] || {};
  const metricsData = activeMetrics.metrics || {};
  const chartsData = activeMetrics.charts || {};
  const isDark = dashboardTheme === 'dark';

  const handleQuickFilter = (range) => {
    const today = new Date();
    const format = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (range === 'Today') {
      setStartDate(format(today));
      setEndDate(format(today));
    } else if (range === 'Yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      setStartDate(format(yesterday));
      setEndDate(format(yesterday));
    } else if (range === 'Week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      setStartDate(format(weekAgo));
      setEndDate(format(today));
    } else if (range === 'Month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(format(firstDay));
      setEndDate(format(today));
    } else if (range === 'Year') {
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      setStartDate(format(firstDayOfYear));
      setEndDate(format(today));
    }
  };

  const getActiveRange = () => {
    const today = new Date();
    const format = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };
    
    const todayStr = format(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = format(yesterday);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const weekAgoStr = format(weekAgo);
    
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayStr = format(firstDay);
    
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
    const firstDayOfYearStr = format(firstDayOfYear);
    
    if (startDate === todayStr && endDate === todayStr) return 'Today';
    if (startDate === yesterdayStr && endDate === yesterdayStr) return 'Yesterday';
    if (startDate === weekAgoStr && endDate === todayStr) return 'Week';
    if (startDate === firstDayStr && endDate === todayStr) return 'Month';
    if (startDate === firstDayOfYearStr && endDate === todayStr) return 'Year';
    return '';
  };

  const activeRange = getActiveRange();

  // Doughnut calculations
  const modeData = chartsData.mode_of_payments || [];
  const totalModeVal = modeData.reduce((acc, curr) => acc + (curr.value || 0), 0) || 1;
  const pieColors = isDark 
    ? ['#38bdf8', '#34d399', '#fbbf24', '#f472b6', '#818cf8'] 
    : ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

  // Real data only — no fallback dummy data
  const itemsToRender = chartsData.top_items || [];
  const cashiersToRender = chartsData.top_cashiers || [];

  return (
    <div className={`dashboard-modern-container ${isDark ? 'dark' : ''}`}>
        
        {/* Top Header Block matching vnivesh layout */}
        <div className="exec-header-row">
          <h1 className="exec-title">Dashboard</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div className="exec-quick-filters">
              {['Yesterday', 'Today', 'Week', 'Month', 'Year'].map(range => (
                <button
                  key={range}
                  onClick={() => handleQuickFilter(range)}
                  className={`exec-filter-tab ${activeRange === range ? 'active' : ''}`}
                >
                  {range}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Search for metrics..." 
                  className="exec-search-input"
                  style={{
                    padding: '0.5rem 1rem 0.5rem 2.2rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    width: '180px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                />
                <svg style={{ position: 'absolute', left: '0.75rem', width: '1rem', height: '1rem', color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>

              {/* Theme Toggle Pill (Dark Command Center / Modern Light) */}
              <button
                onClick={() => {
                  const newTheme = isDark ? 'light' : 'dark';
                  setDashboardTheme(newTheme);
                  localStorage.setItem('dashboardTheme', newTheme);
                }}
                className={`theme-toggle-pill ${isDark ? 'dark' : ''}`}
                title="Toggle Light / Dark Dashboard Theme"
              >
                {isDark ? (
                  <>
                    <Sun size={15} color="#38bdf8" />
                    <span>Light</span>
                  </>
                ) : (
                  <>
                    <Moon size={15} color="#475569" />
                    <span>Dark</span>
                  </>
                )}
              </button>

              <div className="exec-icon-btn" style={{ width: '38px', height: '38px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}>
                <Bell size={18} style={{ margin: 'auto' }} />
              </div>
              <div className="exec-icon-btn" style={{ width: '38px', height: '38px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}>
                <Clock size={18} style={{ margin: 'auto' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Global Admin Branch Selector if admin */}
        <FilterBar
          isAdmin={isAdmin}
          branches={branches}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />

        <div style={{ marginBottom: '2rem' }}>
          <EmployeeCheckinWidget employee={typeof user === 'object' ? user : { name: user }} />
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading store analytics...</div>
        ) : (
          <>
            {/* FIRST ROW GRID: Chart (55% width) | Income Pie (22.5% width) | KPI Stack (22.5% width) */}
            <div className="exec-grid-row1">
              
              {/* Daily Sales Trend Card */}
              <div className="exec-chart-card">
                <div className="exec-chart-header">
                  <div className="exec-chart-info">
                    <span className="exec-chart-title">Daily Sales</span>
                    <span className="exec-chart-value">AED {(metricsData.sales ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="exec-chart-trend">↑ Store revenue trend</span>
                  </div>
                  <button onClick={() => setActiveItem('Sales Summary Report')} className="exec-chart-btn">View Report</button>
                </div>

                <div style={{ width: '100%', height: '180px', marginTop: 'auto' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartsData.sales_trend || []}>
                      <defs>
                        <linearGradient id="execSalesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isDark ? "#38bdf8" : "#4f46e5"} stopOpacity={isDark ? 0.5 : 0.4} />
                          <stop offset="95%" stopColor={isDark ? "#38bdf8" : "#4f46e5"} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"} />
                      <XAxis 
                        dataKey="date" 
                        hide={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 9 }}
                        tickFormatter={(val) => {
                          try {
                            const d = new Date(val);
                            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          } catch (e) {
                            return val;
                          }
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '8px', 
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          color: isDark ? '#f8fafc' : '#0f172a',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' 
                        }} 
                        formatter={(val) => [`AED ${parseFloat(val).toFixed(2)}`, 'Sales']}
                      />
                      <Area type="monotone" dataKey="sales" stroke={isDark ? "#38bdf8" : "#4f46e5"} strokeWidth={3} fill="url(#execSalesGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Total Income Payment Modes Doughnut */}
              <div className="exec-income-card">
                <div className="exec-income-header">
                  <span className="exec-income-title">Total Income</span>
                  <select className="exec-income-select">
                    <option>Today</option>
                  </select>
                </div>

                <div className="exec-doughnut-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={modeData.length > 0 ? modeData : [{ name: 'No Payments', value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {(modeData.length > 0 ? modeData : [{ name: 'No Payments', value: 1 }]).map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <div className="exec-doughnut-center-text">
                    <span className="exec-doughnut-center-val">AED {(metricsData.sales ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="exec-doughnut-center-label">Sales</span>
                  </div>
                </div>

                <div className="exec-legend-list">
                  {(modeData.length > 0 ? modeData : [{ name: 'No Payments', value: 1 }]).slice(0, 3).map((item, idx) => (
                    <div key={idx} className="exec-legend-item">
                      <div className="exec-legend-bullet-row">
                        <span className="exec-legend-bullet" style={{ backgroundColor: pieColors[idx % pieColors.length] }}></span>
                        {item.name}
                      </div>
                      <span className="exec-legend-percent">
                        {modeData.length > 0 ? `${Math.round((item.value / totalModeVal) * 100)}%` : '0%'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stacked KPI Cards */}
              <div className="exec-kpi-stack">
                {/* KPI Card 1: Total Orders */}
                <div className="stacked-kpi-card" style={{ flex: 1 }}>
                  <div className="stacked-kpi-header">
                    <div className="stacked-kpi-info-box">
                      <span className="stacked-kpi-title">Total Invoices</span>
                      <span className="stacked-kpi-trend neg">Active registers: {metricsData.active_registers ?? 0}</span>
                    </div>
                    <div className="stacked-kpi-icon-box orange">
                      <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                  </div>
                  <span className="stacked-kpi-value">{(metricsData.todays_receipts ?? 0).toLocaleString()}</span>
                  
                  <div className="stacked-kpi-progress-track">
                    <div className="stacked-kpi-progress-fill orange" style={{ width: `${Math.min(((metricsData.todays_receipts ?? 0) / 50) * 100, 100)}%` }}></div>
                  </div>
                </div>

                {/* KPI Card 2: New Customers */}
                <div className="stacked-kpi-card" style={{ flex: 1 }}>
                  <div className="stacked-kpi-header">
                    <div className="stacked-kpi-info-box">
                      <span className="stacked-kpi-title">New Customers</span>
                      <span className="stacked-kpi-trend pos">Active registrations</span>
                    </div>
                    <div className="stacked-kpi-icon-box green">
                      <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                    </div>
                  </div>
                  <span className="stacked-kpi-value">{(metricsData.new_customers ?? 0).toLocaleString()}</span>

                  <div className="stacked-kpi-progress-track">
                    <div className="stacked-kpi-progress-fill green" style={{ width: `${Math.min(((metricsData.new_customers ?? 0) / 20) * 100, 100)}%` }}></div>
                  </div>
                </div>
              </div>

            </div>

            {/* SECOND ROW GRID: Trending Items (50% width) | Best Employees (50% width) */}
            <div className="exec-grid-row2">
              
              {/* Trending Items List */}
              <div className="exec-table-card">
                <div className="exec-table-header-row">
                  <span className="exec-table-title">Trending Items</span>
                  <select className="exec-income-select">
                    <option>Today</option>
                  </select>
                </div>

                <table className="exec-table">
                  <thead>
                    <tr>
                      <th>Items</th>
                      <th style={{ textAlign: 'right' }}>Qty Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsToRender.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                          No trending items for this period
                        </td>
                      </tr>
                    ) : itemsToRender.map((item, idx) => {
                      const tagClass = (item.category || '').toLowerCase().includes('food') ? 'food' : ((item.category || '').toLowerCase().includes('drink') ? 'drinks' : 'others');
                      const tagLabel = item.category || 'Product';
                      const bgColors = ['#ffe4e6', '#dcfce7', '#fef9c3', '#e0f2fe', '#f3e8ff'];
                      const textColors = ['#e11d48', '#16a34a', '#ca8a04', '#0284c7', '#9333ea'];
                      
                      return (
                        <tr key={idx}>
                          <td>
                            <div className="exec-user-cell">
                              <span className="exec-avatar-circle" style={{ backgroundColor: bgColors[idx % bgColors.length], color: textColors[idx % textColors.length] }}>
                                {(item.item_name || 'I')[0]}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className={`exec-item-tag ${tagClass}`}>{tagLabel}</span>
                                <span className="exec-user-name">{item.item_name}</span>
                                <span className="exec-user-subtext" style={{ fontSize: '0.65rem' }}>{item.item_code}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>{item.qty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Best Employees / Cashiers List */}
              <div className="exec-table-card">
                <div className="exec-table-header-row">
                  <span className="exec-table-title">Best Employees</span>
                  <select className="exec-income-select">
                    <option>Today</option>
                  </select>
                </div>

                <table className="exec-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th style={{ textAlign: 'right' }}>Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashiersToRender.length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                          No employee data for this period
                        </td>
                      </tr>
                    ) : cashiersToRender.map((emp, idx) => {
                      const initials = (emp.name || 'E').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                      const bgColors = isDark 
                        ? ['rgba(22, 163, 74, 0.2)', 'rgba(59, 130, 246, 0.2)', 'rgba(234, 88, 12, 0.2)', 'rgba(147, 51, 234, 0.2)', 'rgba(239, 68, 68, 0.2)']
                        : ['#f0fdf4', '#eff6ff', '#fff7ed', '#faf5ff', '#fef2f2'];
                      const textColors = isDark
                        ? ['#4ade80', '#60a5fa', '#fb923c', '#c084fc', '#f87171']
                        : ['#16a34a', '#3b82f6', '#ea580c', '#9333ea', '#ef4444'];
                      
                      return (
                        <tr key={idx}>
                          <td>
                            <div className="exec-user-cell">
                              <span className="exec-avatar-circle" style={{ backgroundColor: bgColors[idx % bgColors.length], color: textColors[idx % textColors.length] }}>
                                {initials}
                              </span>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="exec-user-name">{emp.name}</span>
                                <span className="exec-user-subtext">Cashier</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800 }}>
                            AED {parseFloat(emp.sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </>
        )}
    </div>
  );
}

export default Dashboard;