import React, { useState } from 'react';
import { Calendar, Search, Filter, Package } from 'lucide-react';

function ReportFilters({ 
  onFilterChange, 
  initialFilters, 
  customers = [], 
  suppliers = [], 
  items = [], 
  reportType = 'sales' 
}) {
  const [localFilters, setLocalFilters] = useState(initialFilters || {
    from_date: '',
    to_date: '',
    customer: '',
    supplier: '',
    item_code: '',
    pos_invoice: ''
  });

  const handleChange = (key, value) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-5 h-5 text-slate-500" />
        <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* From Date */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
            <Calendar className="w-4 h-4" /> From Date
          </label>
          <input
            type="date"
            value={localFilters.from_date}
            onChange={(e) => handleChange('from_date', e.target.value)}
            max={today}
            className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* To Date */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
            <Calendar className="w-4 h-4" /> To Date
          </label>
          <input
            type="date"
            value={localFilters.to_date}
            onChange={(e) => handleChange('to_date', e.target.value)}
            max={today}
            className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Customer / Supplier */}
        <div className="flex flex-col">
          <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
            <Search className="w-4 h-4" />
            {reportType === 'purchase' ? 'Supplier' : 'Customer'}
          </label>
          <select
            value={reportType === 'purchase' ? localFilters.supplier : localFilters.customer}
            onChange={(e) => handleChange(reportType === 'purchase' ? 'supplier' : 'customer', e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All {reportType === 'purchase' ? 'Suppliers' : 'Customers'}</option>
            {(reportType === 'purchase' ? suppliers : customers).map((item) => (
              <option key={item.name} value={item.name}>
                {item.supplier_name || item.customer_name || item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Item Code - Only for item_sales */}
        {reportType === 'item_sales' && (
          <div className="flex flex-col">
            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              <Package className="w-4 h-4" /> Item
            </label>
            <select
              value={localFilters.item_code}
              onChange={(e) => handleChange('item_code', e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Items</option>
              {items.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.item_name} ({item.item_code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* POS Invoice - Optional */}
        {reportType === 'item_sales' && (
          <div className="flex flex-col">
            <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
              Invoice
            </label>
            <input
              type="text"
              placeholder="POS-INV-..."
              value={localFilters.pos_invoice || ''}
              onChange={(e) => handleChange('pos_invoice', e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
            />
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-md">
        <p className="text-sm font-medium text-blue-800">
          {reportType === 'purchase' 
            ? 'Purchase report shows item-wise invoices with tax breakdown.'
            : reportType === 'item_sales'
            ? 'Item-wise sales with Qty, Rate, Discount, Tax & Total.'
            : 'Sales report with payment modes and taxes.'
          }
        </p>
      </div>
    </div>
  );
}

export default ReportFilters;