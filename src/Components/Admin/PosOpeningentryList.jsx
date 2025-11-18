// src/pages/PosOpeningentryList.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Store, Building, Clock, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import NavBar from '../Nav/NavBar';
import { useNavigate } from 'react-router-dom';

function PosOpeningentryList() {
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterPosProfile, setFilterPosProfile] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  const navigate = useNavigate();
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
  const getSession = () => localStorage.getItem('session') || '';

  /* ────────────────────── FETCH OPENING ENTRIES ────────────────────── */
  useEffect(() => {
    fetchOpenings();
  }, [currentPage, pageSize, filterPosProfile, filterCompany]);

  const fetchOpenings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page_length: pageSize,
        page_start: (currentPage - 1) * pageSize
      });

      // Optional filters (you can extend backend to support these)
      if (filterPosProfile) params.append('pos_profile', filterPosProfile);
      if (filterCompany) params.append('company', filterCompany);

      const res = await fetch(`${API_PATH}.get_opening_entries?${params}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });

      const data = await res.json();
      if (data.message?.status === 'success') {
        setOpenings(data.message.data);
        setTotal(data.message.data.length); // Approximate, or return total from backend
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
            <h1 className="text-xl font-semibold text-gray-900">POS Opening Entries</h1>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <span>Open Shifts</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/pos-opening-create')}
            className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Open New Shift</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border-b px-6 py-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filterPosProfile}
                onChange={e => setFilterPosProfile(e.target.value)}
                placeholder="Filter by POS Profile"
                className="w-full pl-10 pr-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <Building className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filterCompany}
                onChange={e => setFilterCompany(e.target.value)}
                placeholder="Filter by Company"
                className="w-full pl-10 pr-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <main className="p-6">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opening ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">POS Profile</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan="5" className="text-center py-10 text-gray-500">Loading...</td></tr>
                  ) : openings.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-10 text-gray-500">No open shifts found</td></tr>
                  ) : (
                    openings.map(entry => (
                      <tr 
                        key={entry.name} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/pos-opening/${entry.name}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {entry.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(entry.period_start_date).toLocaleString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1">
                            <Store className="w-4 h-4 text-gray-400" />
                            {entry.pos_profile}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-1">
                            <Building className="w-4 h-4 text-gray-400" />
                            {entry.company}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {entry.status}
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
                  Page {currentPage} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages || 1, prev + 1))}
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

export default PosOpeningentryList;