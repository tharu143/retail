
import React, { useState } from 'react';
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
  ArrowRightLeft,
  ClipboardList,
  PieChart,
  LayoutDashboard,
  Tag,
  Layers,
  Lock,
  Settings,
  UserCheck,
  PlusCircle,
  RotateCcw
} from 'lucide-react';
import { useSelector } from 'react-redux';
import QuickStockInStandalone from './QuickStockInStandalone';
import './DashBoard.css';

const routeMap = {
  // Purchase
  'Supplier': { path: '/supplierlist', icon: Users },
  'New Purchase Order': { path: '/purchaseorder', icon: ClipboardList },
  'Purchase Order List': { path: '/purchaseorderlist', icon: FileText },
  'Purchase Receipt': { path: '/purchasereceiptlist', icon: Truck },
  'Purchase Invoice': { path: '/purchaseinvoicelist', icon: Receipt },
  'Purchase Return': { path: '/purchasereturn', icon: ArrowRightLeft },

  // Sales
  'Customer': { path: '/customerlist', icon: UserCheck },
  'Sales Order': { path: '/salesorderlist', icon: PackageCheck },
  'Sales Invoice': { path: '/salesinvoice', icon: Receipt },
  'Delivery Note': { path: '/deliverynote', icon: Truck },
  'Sales Return': { path: '/salesreturn', icon: RotateCcw },

  // Stock
  'Item List': { path: '/itemlist', icon: Boxes },
  'Price List': { path: '/itempricelist', icon: Tag },
  'Item Group': { path: '/itemgrouplist', icon: Layers },
  'Quick Stock-In': { path: '/quickstockin', icon: PlusCircle },
  'Stock Balance Report': { path: '/stockbalancereport', icon: FileText },

  // POS
  'POS Profile': { path: '/posprofilelist', icon: LayoutDashboard },
  'Opening Entry': { path: '/posopeningentrylist', icon: Lock },
  'Closing Entry List': { path: '/posclosingentrylist', icon: FileText },
  'New Closing Entry': { path: '/closingentry', icon: Monitor },
  'POS Invoices': { path: '/invoicelist', icon: Receipt },
  'Sync Manager': { path: '/syncmanager', icon: ClipboardList },
  'Inter-Branch Requests': { path: '/interbranchrequests', icon: ArrowRightLeft },
  'New Transfer Request': { path: '/newinterbranchrequest', icon: PlusCircle },

  // Reports
  'Sales Report': { path: '/salesreport', icon: BarChart3 },
  'Purchase Report': { path: '/purchasereport', icon: TrendingUp },
  'Item Wise Report': { path: '/itemwisereport', icon: PieChart },

  // System
  'POS Health': { path: '/poshealth', icon: TrendingUp },
  'Settings': { path: '/settings', icon: Settings },
};

function Dashboard() {
  const user = useSelector(state => state.user.user);
  const theme = useSelector(state => state.user.theme);

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
      items: ['Customer', 'Sales Order', 'Sales Invoice', 'Sync Manager', 'Delivery Note', 'Sales Return'],
    },
    {
      title: 'Stock Management',
      icon: Boxes,
      colorClass: 'icon-items',
      cardClass: 'card-items',
      items: ['Item List', 'Item Group', 'Price List', 'Quick Stock-In', 'Stock Balance Report'],
    },
    {
      title: 'POS Operations',
      icon: Monitor,
      colorClass: 'icon-pos',
      cardClass: 'card-pos',
      items: ['POS Profile'],
    },
    {
      title: 'Analytics',
      icon: BarChart3,
      colorClass: 'icon-reports',
      cardClass: 'card-reports',
      items: ['Sales Report', 'Purchase Report', 'Item Wise Report'],
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
      icon: Settings,
      colorClass: 'icon-pos',
      cardClass: 'card-pos',
      items: ['POS Health', 'Settings'],
    },
  ];

  return (
    <div className="dashboard-modern-container">
      <div className="max-w-7xl mx-auto">
        
        <header className="dashboard-header">
          <div className="welcome-text">
            <h1>Welcome back, {typeof user === 'string' && user ? (user.includes('@') ? user.split('@')[0] : user).replace(/^\w/, c => c.toUpperCase()) : (typeof user === 'object' && user ? (user.full_name || user.name) : 'Admin')}! 👋</h1>
            <p>Your store command center is ready.</p>
          </div>
        </header>

        <div className="sections-grid">
          {sections.map((section, index) => (
            <div key={index} className={`nav-card ${section.cardClass}`}>
              <div className="card-title">
                <div className={`card-icon-box ${section.colorClass}`}>
                  <section.icon size={22} />
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
                        <Icon size={18} className="link-icon" />
                        <span>{itemName}</span>
                      </div>
                      <ChevronRight size={16} className="chevron-icon" />
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