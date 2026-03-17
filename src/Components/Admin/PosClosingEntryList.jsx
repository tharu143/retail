// src/pages/PosClosingEntryList.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Calendar, User, DollarSign, Package, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import NavBar from '../Nav/NavBar';
import { useNavigate } from 'react-router-dom';

function PosClosingEntryList() {
  const [closings, setClosings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    pos_profile: '',
    user: '',
    status: ''
  });

  const navigate = useNavigate();
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
  const getSession = () => localStorage.getItem('session') || '';

  /* ────────────────────── FETCH CLOSINGS ────────────────────── */
  useEffect(() => {
    fetchClosings();
  }, [currentPage, pageSize, filters]);

  const fetchClosings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page_length: pageSize,
        page_start: (currentPage - 1) * pageSize,
        filters: JSON.stringify(filters)
      });

      const res = await fetch(`${API_PATH}.get_closing_entries?${params}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });

      const data = await res.json();
      if (data.message?.success) {
        setClosings(data.message.data);
        setTotal(data.message.total);
      } else {
        alert(data.message?.message || 'Failed to load');
      }
    } catch (err) {
      alert('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────── PAGINATION ────────────────────── */
  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-gray-900">POS Closing Entries</h1>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <span>List View</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/closingentry')}
            className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Closing</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border-b px-6 py-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              type="date"
              value={filters.from_date}
              onChange={e => setFilters({ ...filters, from_date: e.target.value })}
              className="px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="From Date"
            />
            <input
              type="date"
              value={filters.to_date}
              onChange={e => setFilters({ ...filters, to_date: e.target.value })}
              className="px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="To Date"
            />
            <input
              type="text"
              value={filters.pos_profile}
              onChange={e => setFilters({ ...filters, pos_profile: e.target.value })}
              className="px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="POS Profile"
            />
            <input
              type="text"
              value={filters.user}
              onChange={e => setFilters({ ...filters, user: e.target.value })}
              className="px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="User"
            />
            <select
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <main className="p-6">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">POS Profile</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Grand Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan="8" className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : closings.length === 0 ? (
                    <tr><td colSpan="8" className="text-center py-10 text-gray-500">No closing entries found</td></tr>
                  ) : (
                    closings.map(c => (
                      <tr key={c.name} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/pos-closing/${c.name}`)}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {c.posting_date}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {c.period_start} - {c.period_end}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4 text-gray-400" />
                            {c.user}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{c.pos_profile}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Package className="w-4 h-4 text-gray-400" />
                            {c.total_quantity}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                          AED {c.net_total.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-600">
                          AED {c.grand_total.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            c.status === 'Submitted' ? 'bg-green-100 text-green-800' :
                            c.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-white px-6 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="text-sm text-gray-700">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} entries
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="ml-3 px-3 py-1 border rounded text-sm"
                >
                  {[10, 20, 50, 100].map(size => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default PosClosingEntryList;