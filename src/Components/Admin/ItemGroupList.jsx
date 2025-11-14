import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';

function ItemGroupList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const [filterName, setFilterName] = useState('');
  const [filterPath, setFilterPath] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    item_group_name: '',
    parent_item_group: 'All Item Groups'
  });
  const [saving, setSaving] = useState(false);

  const [parentGroups, setParentGroups] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (groupSearch.trim()) {
        fetchParentGroups(groupSearch);
      } else {
        setParentGroups([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [groupSearch]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups',
        { withCredentials: true }
      );
      if (res.data.message?.success) {
        setGroups(res.data.message.data || []);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load item groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchParentGroups = async (q) => {
    try {
      const res = await axios.get(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups',
        { params: { search: q }, withCredentials: true }
      );
      if (res.data.success) {
        setParentGroups(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.item_group_name.trim()) {
      alert('Item Group Name is required.');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item_group',
        {
          item_group_name: form.item_group_name.trim(),
          parent_item_group: form.parent_item_group
        },
        { withCredentials: true }
      );

      if (res.data.success) {
        alert(res.data.message);
        setShowForm(false);
        setForm({ item_group_name: '', parent_item_group: 'All Item Groups' });
        fetchGroups();
      } else {
        alert(res.data.message);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return groups.filter(g => {
      const nameMatch = !filterName || g.label.toLowerCase().includes(filterName.toLowerCase());
      const pathMatch = !filterPath || g.label.toLowerCase().includes(filterPath.toLowerCase());
      return nameMatch && pathMatch;
    });
  }, [groups, filterName, filterPath]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">

        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Item Groups</h1>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Item Group
            </button>
          </div>
        </div>

        <main className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow">

              <div className="p-4 border-b bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Name
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={filterName}
                        onChange={(e) => {
                          setFilterName(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search by name..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {filterName && (
                        <button
                          onClick={() => setFilterName('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by Path
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={filterPath}
                        onChange={(e) => {
                          setFilterPath(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search by path..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {filterPath && (
                        <button
                          onClick={() => setFilterPath('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Full Path
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan="2" className="px-6 py-12 text-center text-gray-500">
                          No item groups found
                        </td>
                      </tr>
                    ) : (
                      paginated.map((group) => (
                        <tr key={group.value} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {group.label.split(' > ').pop()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {group.label}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-700">
                    Showing {paginated.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} results
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-700">Rows per page:</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700 min-w-[100px] text-center">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">

              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">New Item Group</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.item_group_name}
                    onChange={(e) => setForm({ ...form, item_group_name: e.target.value })}
                    placeholder="e.g., Electronics"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent Item Group
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      placeholder="Search for parent group..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />

                    {groupSearch && (
                      <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                        {parentGroups.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500 text-center">
                            No groups found
                          </div>
                        ) : (
                          parentGroups.map((group) => (
                            <button
                              key={group.value}
                              type="button"
                              onClick={() => {
                                setForm({ ...form, parent_item_group: group.value });
                                setGroupSearch('');
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors border-b last:border-b-0"
                            >
                              {group.label}
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    <div className="text-sm text-gray-600">
                      Selected: <span className="font-medium">{form.parent_item_group}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ItemGroupList;
