// src/pages/PurchaseInvoiceList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, ChevronDown, Search, Filter, Calendar, Building2, FileText, AlertCircle } from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';
import { format } from 'date-fns';

function PurchaseInvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Fetch Invoices
  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_purchase_invoices',
        { withCredentials: true }
      );
      if (res.data.message?.success) {
        setInvoices(res.data.message.data || []);
      }
    } catch (err) {
      alert('Failed to load purchase invoices');
    } finally {
      setLoading(false);
    }
  };

  // Filter Logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const name = !filterName || inv.name.toLowerCase().includes(filterName.toLowerCase());
      const supplier = !filterSupplier || inv.supplier_name.toLowerCase().includes(filterSupplier.toLowerCase());
      const status = !filterStatus || inv.status === filterStatus;
      const dateFrom = !filterDateFrom || new Date(inv.posting_date) >= new Date(filterDateFrom);
      const dateTo = !filterDateTo || new Date(inv.posting_date) <= new Date(filterDateTo);
      return name && supplier && status && dateFrom && dateTo;
    });
  }, [invoices, filterName, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const total = filteredInvoices.length;
  const paginated = filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Unpaid': return 'bg-yellow-100 text-yellow-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Return': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">

        {/* Top Bar - ERPNext Style */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-gray-900">Purchase Invoice</h1>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <span>List</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/purchase-invoice/new'}
            className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>
        </div>

        {/* List View */}
        <main className="p-6">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading purchase invoices...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </th>
                      {[
                        { label: 'Invoice', state: filterName, setState: setFilterName },
                        { label: 'Supplier', state: filterSupplier, setState: setFilterSupplier },
                        { label: 'Date', state: null, dateFrom: filterDateFrom, dateTo: filterDateTo, setDateFrom: setFilterDateFrom, setDateTo: setFilterDateTo },
                        { label: 'Status', state: filterStatus, setState: setFilterStatus, options: ['Draft', 'Submitted', 'Paid', 'Unpaid', 'Overdue', 'Return', 'Cancelled'] },
                        { label: 'Amount (AED)', align: 'right' },
                      ].map((col, i) => (
                        <th key={i} className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.align || ''}`}>
                          <div className="space-y-1">
                            <span>{col.label}</span>
                            {col.options ? (
                              <select
                                value={col.state}
                                onChange={(e) => col.setState(e.target.value)}
                                className="block w-full text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">All</option>
                                {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : col.dateFrom !== undefined ? (
                              <div className="flex space-x-2">
                                <input
                                  type="date"
                                  value={col.dateFrom}
                                  onChange={e => col.setDateFrom(e.target.value)}
                                  className="text-xs border rounded px-2 py-1"
                                />
                                <input
                                  type="date"
                                  value={col.dateTo}
                                  onChange={e => col.setDateTo(e.target.value)}
                                  className="text-xs border rounded px-2 py-1"
                                />
                              </div>
                            ) : (
                              <div className="relative">
                                <Search className="absolute left-2 top-2 w-3 h-3 text-gray-400" />
                                <input
                                  type="text"
                                  value={col.state || ''}
                                  onChange={(e) => col.setState(e.target.value)}
                                  placeholder="Filter..."
                                  className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p>No purchase invoices found</p>
                        </td>
                      </tr>
                    ) : (
                      paginated.map(inv => (
                        <tr key={inv.name} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/purchase-invoice/${inv.name}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input type="checkbox" className="rounded border-gray-300" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-blue-600 hover:underline">{inv.name}</div>
                              {inv.bill_no && <div className="text-xs text-gray-500">Bill: {inv.bill_no}</div>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <div>
                                <div className="text-sm font-medium">{inv.supplier_name}</div>
                                <div className="text-xs text-gray-500">{inv.supplier}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              {format(new Date(inv.posting_date), 'dd MMM yyyy')}
                            </div>
                            <div className="text-xs text-gray-500">{format(new Date(inv.posting_date), 'hh:mm a')}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(inv.status)}`}>
                              {inv.status === 'Overdue' && <AlertCircle className="w-3 h-3 mr-1" />}
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="text-sm font-semibold">AED {inv.grand_total?.toFixed(2)}</div>
                            {inv.outstanding_amount > 0 && (
                              <div className="text-xs text-red-600">Due: AED {inv.outstanding_amount.toFixed(2)}</div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} invoices
                </div>
                <div className="flex items-center space-x-2">
                  {[20, 50, 100].map(size => (
                    <button
                      key={size}
                      onClick={() => { setPageSize(size); setCurrentPage(1); }}
                      className={`px-3 py-1 text-sm rounded-md ${pageSize === size ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default PurchaseInvoiceList;