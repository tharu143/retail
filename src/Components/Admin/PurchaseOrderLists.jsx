import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Plus, Filter, MoreVertical, Search, Calendar, Building2,
  Package, DollarSign, Loader2, Edit2, Trash2, Eye
} from 'lucide-react';
import { format } from 'date-fns';

const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
const RESOURCE_API = '/api/resource/Purchase Order';

function PurchaseOrderLists() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showActions, setShowActions] = useState(null);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const getSession = () => localStorage.getItem('session') || '';

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_PATH}.get_purchase_orders`, {
        withCredentials: true,
        headers: { 'X-Frappe-SID': getSession() }
      });
      if (res.data?.message?.success) {
        setOrders(res.data.message.data || []);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to fetch POs:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(po => {
      const matchesSupplier = !filterSupplier || 
        (po.supplier_name?.toLowerCase().includes(filterSupplier.toLowerCase()) ||
         po.supplier?.toLowerCase().includes(filterSupplier.toLowerCase()));
      
      const matchesStatus = !filterStatus || po.status === filterStatus;
      
      const matchesFrom = !filterDateFrom || new Date(po.transaction_date) >= new Date(filterDateFrom);
      const matchesTo = !filterDateTo || new Date(po.transaction_date) <= new Date(filterDateTo);

      return matchesSupplier && matchesStatus && matchesFrom && matchesTo;
    });
  }, [orders, filterSupplier, filterStatus, filterDateFrom, filterDateTo]);

  const total = filteredOrders.length;
  const paginated = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(total / pageSize);

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-orange-100 text-orange-800',
      'To Receive': 'bg-blue-100 text-blue-800',
      'Completed': 'bg-green-100 text-green-800',
      'Cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (name) => {
    if (!confirm('Delete this Purchase Order draft?')) return;
    try {
      await axios.delete(`${RESOURCE_API}/${name}`, {
        withCredentials: true,
        headers: { 'X-Frappe-SID': getSession() }
      });
      fetchOrders();
      setShowActions(null);
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleCancel = async (name) => {
    if (!confirm('Cancel this Purchase Order?')) return;
    try {
      await axios.put(`${RESOURCE_API}/${name}`, { docstatus: 2 }, {
        withCredentials: true,
        headers: { 'X-Frappe-SID': getSession() }
      });
      fetchOrders();
      setShowActions(null);
    } catch (err) {
      alert('Cancel failed');
    }
  };

  const clearFilters = () => {
    setFilterSupplier('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-slate-700" />
              Purchase Orders
            </h1>
            <p className="text-slate-600 mt-2">{total} total</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg flex items-center gap-2 hover:bg-slate-50"
            >
              <Filter className="w-5 h-5" /> Filters
            </button>
            <a
              href="/purchase-order"
              className="px-6 py-3 bg-slate-900 text-white rounded-lg flex items-center gap-2 hover:bg-slate-800"
            >
              <Plus className="w-5 h-5" /> Add Purchase Order
            </a>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Supplier</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={filterSupplier}
                    onChange={e => setFilterSupplier(e.target.value)}
                    placeholder="Search supplier..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">All Statuses</option>
                  <option value="Draft">Draft</option>
                  <option value="To Receive">To Receive</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">From Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">To Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Loading purchase orders...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-4 px-6 font-medium text-slate-700">ID</th>
                      <th className="text-left py-4 px-6 font-medium text-slate-700">Supplier</th>
                      <th className="text-left py-4 px-6 font-medium text-slate-700">Status</th>
                      <th className="text-left py-4 px-6 font-medium text-slate-700">Date</th>
                      <th className="text-right py-4 px-6 font-medium text-slate-700">Grand Total</th>
                      <th className="text-center py-4 px-6 font-medium text-slate-700">% Billed</th>
                      <th className="text-center py-4 px-6 font-medium text-slate-700">% Received</th>
                      <th className="text-right py-4 px-6 font-medium text-slate-700">Last Updated</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-12 text-slate-500">
                          <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                          <p className="text-lg">No purchase orders found</p>
                          <a href="/purchase-order" className="mt-4 inline-block text-slate-900 underline">
                            Create your first Purchase Order
                          </a>
                        </td>
                      </tr>
                    ) : (
                      paginated.map((po, idx) => (
                        <tr key={po.name} className={`border-b hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-25'}`}>
                          <td className="py-4 px-6">
                            <a href={`/purchase-order?name=${po.name}`} className="text-slate-900 font-medium hover:underline">
                              {po.name}
                            </a>
                          </td>
                          <td className="py-4 px-6">
                            <div>
                              <div className="font-medium text-slate-900">{po.supplier_name || po.supplier}</div>
                              {po.supplier_name && <div className="text-sm text-slate-500">{po.supplier}</div>}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(po.status)}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-700">
                            {format(new Date(po.transaction_date), 'dd-MM-yyyy')}
                          </td>
                          <td className="py-4 px-6 text-right font-semibold text-slate-900">
                            AED {parseFloat(po.grand_total || 0).toFixed(2)}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-20 bg-slate-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${po.per_billed || 0}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-600">{po.per_billed || 0}%</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-20 bg-slate-200 rounded-full h-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${po.per_received || 0}%` }}
                                />
                              </div>
                              <span className="text-sm text-slate-600">{po.per_received || 0}%</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right text-sm text-slate-500">
                            {po.modified && format(new Date(po.modified), 'dd-MM-yyyy')}
                          </td>
                          <td className="py-4 px-6 text-center relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowActions(showActions === po.name ? null : po.name);
                              }}
                              className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                              <MoreVertical className="w-5 h-5 text-slate-600" />
                            </button>

                            {showActions === po.name && (
                              <div className="absolute right-8 top-12 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-10">
                                <a
                                  href={`/purchase-order?name=${po.name}`}
                                  className="px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                                  onClick={() => setShowActions(null)}
                                >
                                  <Eye className="w-4 h-4" /> View / Edit
                                </a>
                                {po.status === 'Draft' && (
                                  <button
                                    onClick={() => handleDelete(po.name)}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-red-600 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete
                                  </button>
                                )}
                                {po.status !== 'Draft' && po.status !== 'Cancelled' && (
                                  <button
                                    onClick={() => handleCancel(po.name)}
                                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-red-600 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" /> Cancel
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
                  <div className="text-sm text-slate-600">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} orders
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Rows per page:</span>
                      {[20, 50, 100].map(size => (
                        <button
                          key={size}
                          onClick={() => { setPageSize(size); setCurrentPage(1); }}
                          className={`px-3 py-1 rounded ${pageSize === size ? 'bg-slate-900 text-white' : 'hover:bg-slate-100'}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PurchaseOrderLists;