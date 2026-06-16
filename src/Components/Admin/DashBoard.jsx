import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { KpiCard, FilterBar, SalesTrendChart, PurchaseTrendChart, ReceivablesPayablesChart, CustomerTrendChart, StockDistributionChart, PendingOperationsChart } from './DashboardWidgets';
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
  PieChart,
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
  Moon
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
import StockEntryList from './StockEntryList';
import StockBalanceReport from '../Reports/StockBalanceReport';
import StockLedgerReport from '../Reports/StockLedgerReport';
import PosProfileList from './PosProfileList';
import PosOpeningentryList from './PosOpeningentryList';
import PosClosingEntryList from './PosClosingEntryList';
import ClosingEntry from '../OpeningEntry/ClosingEntry';
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
};

function Dashboard() {
  const { user, warehouse, user_roles } = useSelector(state => state.user || {});
  
  // Navigation State
  const [activeItem, setActiveItem] = useState('home');
  const [sidebarTheme, setSidebarTheme] = useState(() => localStorage.getItem('sidebarTheme') || 'light');
  
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
            setBranches([{ name: 'All Branches' }, ...list.map(w => ({ name: w.name }))]);
          } else {
            setBranches([{ name: 'All Branches' }, { name: warehouse || 'Default Warehouse' }]);
          }
        } catch (err) {
          console.error("Failed to fetch warehouses:", err);
          setBranches([{ name: 'All Branches' }, { name: warehouse || 'Default Warehouse' }]);
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
      setLoading(true);
      const data = await getDashboardMetrics(selectedBranch, startDate, endDate);
      
      // Unpack response data robustly
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (e) {
          console.error("Failed to parse data string in dashboard:", e);
        }
      }
      
      let current = parsedData;
      while (current && current.message) {
        current = current.message;
      }
      
      const actualData = (current && current.metrics) ? current : null;
      
      // For debugging, if it fails, we store the raw data in a special property
      setMetrics(actualData || { __debug_fail: true, raw: data, type: typeof data });
      setLoading(false);
    };
    fetchMetrics();
  }, [selectedBranch, startDate, endDate]);
  
  const toggleSidebarTheme = () => {
    const nextTheme = sidebarTheme === 'light' ? 'dark' : 'light';
    setSidebarTheme(nextTheme);
    localStorage.setItem('sidebarTheme', nextTheme);
  };

  const [expandedSections, setExpandedSections] = useState({
    'Procurement': true,
    'Sales & Returns': false,
    'Stock Management': false,
    'POS Operations': false,
    'Reports': false,
    'Inventory Logistics': false,
    'Administration': false
  });

  const toggleSection = (sectionTitle) => {
    setActiveItem(sectionTitle);
    setExpandedSections(prev => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle]
    }));
  };

  const sections = [
    {
      title: 'Procurement',
      icon: ShoppingCart,
      colorClass: 'icon-purchase',
      cardClass: 'card-purchase',
      items: ['Supplier', 'New Purchase Order', 'Purchase Order List', 'Purchase Receipt', 'Purchase Invoice', 'Purchase Return'],
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
      items: ['POS Profile', 'Opening Entry', 'Closing Entry List'],
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
      items: ['POS Health', 'Settings', 'Sync Manager'],
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
      case 'Procurement':
        return <ProcurementDashboard metrics={metrics?.metrics} charts={metrics?.charts} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={branches} />;
      case 'Sales & Returns':
        return <SalesReturnsDashboard metrics={metrics?.metrics} charts={metrics?.charts} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={branches} />;
      case 'Stock Management':
        return <StockManagementDashboard metrics={metrics?.metrics} charts={metrics?.charts} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={branches} />;
      case 'POS Operations':
        return <POSOperationsDashboard metrics={metrics?.metrics} charts={metrics?.charts} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={branches} />;
      case 'Inventory Logistics':
        return <InventoryLogisticsDashboard metrics={metrics?.metrics} charts={metrics?.charts} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={branches} />;
      case 'home':
      default:
        return <DashboardHome user={user} sections={sections} setActiveItem={setActiveItem} metrics={metrics} loading={loading} startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch} isAdmin={isAdmin} branches={branches} />;
    }
  };

  return (
    <div className="dashboard-layout-wrapper">
      {/* Left Navigation Sidebar */}
      <aside className={`sidebar-nav ${sidebarTheme === 'dark' ? 'dark' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            POS<span>8</span>
          </div>
          <div className="sidebar-brand-subtitle">{typeof user === 'string' && user ? (user.includes('@') ? user.split('@')[0] : user).replace(/^\w/, c => c.toUpperCase()) : (typeof user === 'object' && user ? (user.full_name || user.name) : 'Admin')}! 👋</div>
        </div>

        <div className="sidebar-menu">
          {/* Dashboard Home menu item */}
          <div 
            onClick={() => setActiveItem('home')} 
            className={`sidebar-home-link ${activeItem === 'home' ? 'active' : ''}`}
          >
            <Home size={18} />
            <span>Dashboard Home</span>
          </div>

          {/* Section dropdowns */}
          {sections.map((section, idx) => {
            const SectionIcon = section.icon;
            const isExpanded = expandedSections[section.title];
            
            return (
              <div key={idx} className="sidebar-section">
                <div 
                  onClick={() => toggleSection(section.title)}
                  className={`sidebar-section-toggle ${isExpanded ? 'expanded' : ''}`}
                >
                  <div className="sidebar-section-title">
                    <SectionIcon size={18} />
                    <span>{section.title}</span>
                  </div>
                  <ChevronRight 
                    size={14} 
                    className={`sidebar-arrow ${isExpanded ? 'expanded' : ''}`} 
                  />
                </div>

                {isExpanded && (
                  <div className="sidebar-sub-links">
                    {section.items.map((itemName, itemIdx) => {
                      const itemMeta = routeMap[itemName];
                      if (!itemMeta) return null;
                      const SubIcon = itemMeta.icon;
                      
                      return (
                        <div 
                          key={itemIdx}
                          onClick={() => setActiveItem(itemName)}
                          className={`sidebar-sub-item ${activeItem === itemName ? 'active' : ''}`}
                        >
                          <SubIcon size={14} />
                          <span>{itemName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer with Theme Toggle */}
        <div 
          className="sidebar-footer" 
          style={{ 
            borderTop: sidebarTheme === 'dark' ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9', 
            paddingTop: '1rem', 
            marginTop: 'auto' 
          }}
        >
          <button 
            onClick={toggleSidebarTheme}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.5rem', 
              width: '100%', 
              padding: '0.6rem', 
              borderRadius: '0.5rem', 
              border: sidebarTheme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', 
              background: sidebarTheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc',
              color: sidebarTheme === 'dark' ? '#f8fafc' : '#334155',
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s'
            }}
          >
            {sidebarTheme === 'dark' ? (
              <>
                <Sun size={14} />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon size={14} />
                <span>Dark</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Right Dynamic Content Panel */}
      <main className="right-content-panel">
        {renderContent()}
      </main>
    </div>
  );
}


// Inner Component for Dashboard Homepage
function DashboardHome({ user, sections, setActiveItem, metrics, loading, startDate, setStartDate, endDate, setEndDate, selectedBranch, setSelectedBranch, isAdmin, branches }) {
  return (
    <div className="dashboard-modern-container">
      <div className="max-w-7xl mx-auto">
        <header className="dashboard-header">
          <div className="welcome-text">
            <h1>Welcome back, {typeof user === 'string' && user ? (user.includes('@') ? user.split('@')[0] : user).replace(/^\w/, c => c.toUpperCase()) : (typeof user === 'object' && user ? (user.full_name || user.name) : 'Admin')}! 👋</h1>
            <p>Your store command center is ready.</p>
          </div>
        </header>

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

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading metrics...</div>
        ) : !metrics?.__debug_fail && metrics ? (
          <>
            <div className="dashboard-metrics-grid">
              <KpiCard title="Total Sales" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={24} /> {metrics.metrics?.sales ?? 0}</span>} icon={TrendingUp} colorClass="icon-sales" trend={12} />
              <KpiCard title="Purchases" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={24} /> {metrics.metrics?.purchases ?? 0}</span>} icon={ShoppingCart} colorClass="icon-purchase" trend={-5} />
              <KpiCard title="Stock Value" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={24} /> {metrics.metrics?.stock_value ?? 0}</span>} icon={Boxes} colorClass="icon-items" />
              <KpiCard title="New Customers" value={metrics.metrics?.new_customers ?? 0} icon={Users} colorClass="icon-pos" trend={8} />
              <KpiCard title="Receivables" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><DirhamIcon size={24} /> {metrics.metrics?.accounts_receivable ?? 0}</span>} icon={Receipt} colorClass="icon-reports" />
            </div>

            {isAdmin && (
              <div className="dashboard-charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                <SalesTrendChart data={metrics.charts?.sales_trend || []} />
                <PurchaseTrendChart data={metrics.charts?.purchase_trend || []} />
                <ReceivablesPayablesChart data={metrics.charts?.receivables_payables_trend || []} />
                <CustomerTrendChart data={metrics.charts?.customer_trend || []} />
                <StockDistributionChart data={metrics.charts?.stock_distribution || []} />
                <PendingOperationsChart data={metrics.charts?.pending_operations || []} />
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-red-500">
            <h2 className="text-xl font-bold mb-4">Failed to load metrics.</h2>
            <div className="bg-red-50 text-red-900 p-4 text-left rounded overflow-auto max-h-96 text-xs border border-red-200">
              <p className="font-semibold mb-2">Debug - Raw API Data:</p>
              <pre>{JSON.stringify(metrics, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;