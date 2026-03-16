
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  Boxes, 
  Monitor, 
  ChevronRight,
  TrendingUp,
  PackageCheck,
  Receipt,
  Truck,
  FileText,
  ClipboardList,
  PieChart,
  LayoutDashboard,
  Tag,
  Layers,
  Lock,
  Settings,
  UserCheck
} from 'lucide-react';
import { useSelector } from 'react-redux';
import './DashBoard.css';

const routeMap = {
  // Purchase
  'Supplier': { path: '/supplierlist', icon: Users },
  'Purchase Order': { path: '/purchaseorderlist', icon: ClipboardList },
  'Purchase Receipt': { path: '/purchasereceiptlist', icon: Truck },
  'Purchase Invoice': { path: '/purchaseinvoicelist', icon: FileText },

  // Sales
  'Customer': { path: '/customerlist', icon: UserCheck },
  'Sales Order': { path: '/salesorderlist', icon: PackageCheck },
  'Sales Invoice': { path: '/salesinvoice', icon: Receipt },
  'Delivery Note': { path: '/deliverynote', icon: Truck },

  // Reports
  'Sales Report': { path: '/salesreport', icon: BarChart3 },
  'Purchase Report': { path: '/purchasereport', icon: TrendingUp },
  'Item Wise Sales Report': { path: '/itemwisereport', icon: PieChart },

  // Items Management
  'Item': { path: '/itemlist', icon: Boxes },
  'Price List': { path: '/itempricelist', icon: Tag },
  'Item Group': { path: '/itemgrouplist', icon: Layers },

  // POS Management
  'POS Profile': { path: '/posprofilelist', icon: LayoutDashboard },
  'POS Opening Entry': { path: '/posopeningentrylist', icon: Lock },
  'POS Closing Entry': { path: '/posclosingentrylist', icon: Monitor },
  'POS Invoice': { path: '/invoicelist', icon: Receipt },
  'POS Health': { path: '/poshealth', icon: TrendingUp },
  'Settings': { path: '/settings', icon: Settings },
};

function Dashboard() {
  const user = useSelector(state => state.user.user);
  const theme = useSelector(state => state.user.theme);

  const sections = [
    {
      title: 'Purchase',
      icon: ShoppingCart,
      colorClass: 'icon-purchase',
      items: ['Supplier', 'Purchase Order', 'Purchase Receipt', 'Purchase Invoice'],
    },
    {
      title: 'Sales',
      icon: TrendingUp,
      colorClass: 'icon-sales',
      items: ['Customer', 'Sales Order', 'Sales Invoice', 'Delivery Note'],
    },
    {
      title: 'Reports',
      icon: BarChart3,
      colorClass: 'icon-reports',
      items: ['Sales Report', 'Purchase Report', 'Item Wise Sales Report'],
    },
    {
      title: 'Items Management',
      icon: Boxes,
      colorClass: 'icon-items',
      items: ['Item', 'Price List', 'Item Group'],
    },
    {
      title: 'POS Management',
      icon: Monitor,
      colorClass: 'icon-pos',
      items: ['POS Profile', 'POS Opening Entry', 'POS Closing Entry', 'POS Invoice', 'POS Health', 'Settings'],
    },
  ];

  return (
    <div className={`dashboard-modern-container ${theme === 'legacy' ? 'theme-legacy' : ''}`}>
      <div className="max-w-7xl mx-auto">
        
        <header className="dashboard-header">
          <div className="welcome-text">
            <h1>Welcome back, {typeof user === 'object' ? (user?.full_name || user?.name) : 'Admin'}! 👋</h1>
            <p>Here is what is happening with your store today.</p>
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Sales (Today)</span>
            <span className="stat-value">OMR 1,240.50</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Orders</span>
            <span className="stat-value">48</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Net Profit</span>
            <span className="stat-value">OMR 312.20</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">New Customers</span>
            <span className="stat-value">+12</span>
          </div>
        </div>

        <div className="sections-grid">
          {sections.map((section, index) => (
            <div key={index} className="nav-card">
              <div className="card-title">
                <div className={`card-icon-box ${section.colorClass}`}>
                  <section.icon size={20} />
                </div>
                {section.title}
              </div>
              <div className="nav-links">
                {section.items.map((itemName, itemIndex) => {
                  const itemData = routeMap[itemName];
                  if (!itemData) return null;
                  const Icon = itemData.icon;
                  return (
                    <Link
                      key={itemIndex}
                      to={itemData.path}
                      className="nav-link-item"
                    >
                      <div className="link-name-box">
                        <Icon size={16} className="text-gray-400" />
                        <span>{itemName}</span>
                      </div>
                      <ChevronRight size={14} className="chevron-icon" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;