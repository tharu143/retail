import React, { useState, useEffect } from 'react';
import kyleLogo from '../../assets/kyleretail.png';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ShoppingCart,
  Users,
  BarChart3,
  Boxes,
  Monitor,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
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
  Wallet,
  Settings as SettingsIcon,
  UserCheck,
  PlusCircle,
  Activity,
  RotateCcw,
  Home,
  Sun,
  Moon
} from 'lucide-react';

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
  'Product Bundles': { icon: Boxes },
  'Stock Entry': { icon: Activity },
  'Stock Balance Report': { icon: FileText },
  'Stock Ledger Report': { icon: FileText },

  // POS
  'POS Profile': { icon: LayoutDashboard },
  'Opening Entry': { icon: Lock },
  'Closing Entry List': { icon: FileText },
  'New Closing Entry': { icon: Monitor },
  'Cash Collection': { icon: Wallet },
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
    items: ['Item List', 'Item Group', 'Price List', 'Product Bundles', 'Stock Entry', 'Stock Balance Report', 'Stock Ledger Report'],
  },
  {
    title: 'POS Operations',
    icon: Monitor,
    colorClass: 'icon-pos',
    cardClass: 'card-pos',
    items: ['POS Profile', 'Opening Entry', 'Closing Entry List', 'Cash Collection'],
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

function Sidebar({ activeItem: propsActiveItem, setActiveItem: propsSetActiveItem, isStandalone = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector(state => state.user || {});

  const [sidebarTheme, setSidebarTheme] = useState(() => localStorage.getItem('sidebarTheme') || 'light');
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }, [isCollapsed]);

  const getActiveItemFromPath = (pathname) => {
    if (pathname.includes('/supplier')) return 'Supplier';
    if (pathname === '/purchaseorder') return 'New Purchase Order';
    if (pathname === '/purchaseorderlist') return 'Purchase Order List';
    if (pathname === '/purchasereceiptlist') return 'Purchase Receipt';
    if (pathname === '/purchaseinvoicelist') return 'Purchase Invoice';
    if (pathname === '/purchasereturn') return 'Purchase Return';

    if (pathname.includes('/customer')) return 'Customer';
    if (pathname.includes('/salesorder')) return 'Sales Order';
    if (pathname === '/salesinvoice') return 'Sales Invoice';
    if (pathname.includes('/deliverynote')) return 'Delivery Note';
    if (pathname === '/salesreturn') return 'Sales Return';

    if (pathname.includes('/item-details') || pathname === '/itemlist') return 'Item List';
    if (pathname === '/itempricelist') return 'Price List';
    if (pathname === '/itemgrouplist') return 'Item Group';
    if (pathname === '/product-bundles') return 'Product Bundles';
    if (pathname.includes('/stock-entry') || pathname === '/stock-entries') return 'Stock Entry';
    if (pathname === '/stockbalancereport') return 'Stock Balance Report';
    if (pathname === '/stockledgerreport') return 'Stock Ledger Report';

    if (pathname === '/posprofilelist') return 'POS Profile';
    if (pathname === '/posopeningentrylist') return 'Opening Entry';
    if (pathname === '/posclosingentrylist' || pathname === '/closingentry') return 'Closing Entry List';
    if (pathname === '/closingcollection' || pathname === '/closing-collection' || pathname === '/cashcollection' || pathname === '/cash-collection') return 'Cash Collection';

    if (pathname.includes('/interbranchrequest') && !pathname.includes('new')) return 'Inter-Branch Requests';
    if (pathname === '/newinterbranchrequest') return 'New Transfer Request';

    if (pathname === '/dailysalesreport') return 'Daily Sales Report';
    if (pathname === '/salesreport') return 'Sales Summary Report';
    if (pathname === '/purchasereport') return 'Purchase Report';
    if (pathname === '/itemwisereport') return 'Item Wise Report';
    if (pathname === '/generalledgerreport') return 'General Ledger';

    if (pathname === '/poshealth') return 'POS Health';
    if (pathname === '/settings') return 'Settings';
    if (pathname === '/syncmanager') return 'Sync Manager';
    if (pathname === '/documentation') return 'Documentation';

    return 'home';
  };

  const pathActiveItem = getActiveItemFromPath(location.pathname);
  const activeItem = isStandalone ? pathActiveItem : (propsActiveItem || 'home');

  const handleItemClick = (itemName) => {
    localStorage.setItem('dashboardActiveItem', itemName);
    if (searchParams.toString() !== "") {
      setSearchParams({}, { replace: true });
    }
    if (isStandalone) {
      navigate('/dashboard');
    } else {
      if (propsSetActiveItem) {
        propsSetActiveItem(itemName);
      }
    }
  };

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

  // Auto-expand accordion when activeItem changes
  useEffect(() => {
    const parentSection = sections.find(sec => sec.items.includes(activeItem));
    if (parentSection) {
      setExpandedSections(prev => ({
        ...prev,
        [parentSection.title]: true
      }));
    }
  }, [activeItem]);

  const toggleSection = (sectionTitle) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setExpandedSections({
        [sectionTitle]: true
      });
    } else {
      setExpandedSections(prev => ({
        ...prev,
        [sectionTitle]: !prev[sectionTitle]
      }));
    }
  };

  const getBranchName = (wh) => {
    if (!wh) return '';
    return wh.replace(/\s*Warehouse\s*/gi, ' ').replace(/\s*-\s*\w+$/, '').trim() || wh;
  };

  return (
    <aside className={`sidebar-nav ${sidebarTheme === 'dark' ? 'dark' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', width: '100%' }}>
          {!isCollapsed ? (
            <div className="sidebar-brand flex items-center">
              <img src={kyleLogo} alt="Logo" className="h-10 object-contain mix-blend-multiply" />
            </div>
          ) : (
            <div className="sidebar-brand flex items-center" style={{ paddingLeft: '4px' }}>
              <img src={kyleLogo} alt="Logo" className="h-8 object-contain mix-blend-multiply" />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="sidebar-collapse-toggle"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: sidebarTheme === 'dark' ? '#94a3b8' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '4px',
              transition: 'all 0.2s',
            }}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        {!isCollapsed && (
          <div className="sidebar-brand-subtitle flex flex-col items-start gap-1.5 mt-2">
            <div className="sidebar-user-greeting" style={{ color: sidebarTheme === 'dark' ? '#f8fafc' : '#0f172a', fontWeight: 800, fontSize: '0.85rem' }}>
              {typeof user === 'string' && user
                ? (user.includes('@') ? user.split('@')[0] : user).replace(/^\w/, c => c.toUpperCase())
                : (typeof user === 'object' && user ? (user.full_name || user.name) : 'Admin')}! 👋
            </div>
            {activeItem && activeItem !== 'home' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-[#0082f6] border border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800/80 shadow-2xs">
                {activeItem.replace(/[-_]/g, ' ')}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-menu">
        {/* Dashboard Home menu item */}
        <div
          onClick={() => handleItemClick('home')}
          className={`sidebar-home-link ${activeItem === 'home' ? 'active' : ''}`}
          title={isCollapsed ? "Dashboard Home" : ""}
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
                title={isCollapsed ? section.title : ""}
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

              {isExpanded && !isCollapsed && (
                <div className="sidebar-sub-links">
                  {section.items.map((itemName, itemIdx) => {
                    const itemMeta = routeMap[itemName];
                    if (!itemMeta) return null;
                    const SubIcon = itemMeta.icon;

                    return (
                      <div
                        key={itemIdx}
                        onClick={() => handleItemClick(itemName)}
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
  );
}

export default Sidebar;
