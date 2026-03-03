
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';


const routeMap = {
  // Purchase Sales
  'Purchase Order': '/purchaseorderlist',
  'Purchase Invoice': '/purchaseinvoicelist',
  'Supplier': '/supplierlist',
  'Purchase Receipt': '/purchasereceiptlist',

  // Sales
  'Customer': '/customerlist',
  'Sales Order': '/salesorderlist',
  'Sales Invoice': '/salesinvoice',
  'Delivery Note': '/deliverynote',


  // Reports (you can add real report pages later)
  'Sales Report': '/salesreport',
  'Purchase Report': '/purchasereport',
  'Item Wise Sales Report': '/itemwisereport',

  // Items Management
  'Item': '/itemlist',
  'Price List': '/itempricelist',
  'Item Group': '/itemgrouplist',

  // POS Management
  'POS Profile': '/posprofilelist',
  'POS Opening Entry': '/posopeningentrylist',
  'POS Closing Entry': '/posclosingentrylist',
  'POS Invoice': '/invoicelist',
  'POS Health': '/poshealth',
  'Settings': '/settings',
};

function Dashboard() {
  const sections = [
    {
      title: 'Purchase',
      items: [
        'Supplier',
        'Purchase Order',
        'Purchase Receipt',
        'Purchase Invoice',

      ],
    },
    {
      title: 'Sales',
      items: [
        'Customer',
        'Sales Order',
        'Sales Invoice',
        'Delivery Note',
      ],
    },
    {
      title: 'Reports',
      items: [
        'Sales Report',
        'Purchase Report',
        'Item Wise Sales Report',
      ],
    },
    {
      title: 'Items Management',
      items: [
        'Item',
        'Price List',
        'Item Group',
      ],
    },
    {
      title: 'POS Management',
      items: [
        'POS Profile',
        'POS Opening Entry',
        'POS Closing Entry',
        'POS Invoice',
        'POS Health',
        'Settings'
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {section.title}
                </h2>
                <div className="space-y-2">
                  {section.items.map((item, itemIndex) => {
                    const to = routeMap[item] || '#'; // fallback if missing
                    return (
                      <Link
                        key={itemIndex}
                        to={to}
                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors group"
                      >
                        <span>{item}</span>
                        <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;