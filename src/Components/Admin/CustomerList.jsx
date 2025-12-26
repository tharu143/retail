// src/pages/CustomerList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Save, X, Phone, Mail, Users, ChevronLeft
} from 'lucide-react';
import NavBar from '../Nav/NavBar';

function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterName, setFilterName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    mobile_no: '',
    email_id: ''
  });
  const [saving, setSaving] = useState(false);

  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';
  const getSession = () => localStorage.getItem('session') || '';

  /* ────────────────────── FETCH CUSTOMERS ────────────────────── */
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_PATH}.get_customers_list`, {
          headers: { 'X-Frappe-SID': getSession() },
          credentials: 'include'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCustomers((data.message?.data || []).map(c => ({
          value: c.value,
          label: c.label,
          mobile: c.mobile,
          email: c.email
        })));
      } catch (err) {
        alert('Failed to load customers. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  /* ────────────────────── FILTER & PAGINATION ────────────────────── */
  const filtered = useMemo(() => {
    return customers.filter(c =>
      !filterName || c.label.toLowerCase().includes(filterName.toLowerCase())
    );
  }, [customers, filterName]);

  const total = filtered.length;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ────────────────────── CREATE/UPDATE CUSTOMER ────────────────────── */
  const handleSave = async () => {
    if (!form.customer_name.trim()) {
      alert('Customer Name is required.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_PATH}.create_or_update_customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-SID': getSession()
        },
        credentials: 'include',
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          mobile_no: form.mobile_no.trim() || null,
          email_id: form.email_id.trim() || null
        })
      });

      const result = await res.json();

      if (result.message?.success) {
        alert('Customer saved successfully!');
        setShowForm(false);
        setForm({ customer_name: '', mobile_no: '', email_id: '' });

        // Refresh customers list
        const refresh = await fetch(`${API_PATH}.get_customers_list`, {
          headers: { 'X-Frappe-SID': getSession() },
          credentials: 'include'
        });
        const data = await refresh.json();
        setCustomers((data.message?.data || []).map(c => ({
          value: c.value,
          label: c.label,
          mobile: c.mobile,
          email: c.email
        })));
        setCurrentPage(1); // reset to first page
      } else {
        alert(result.message?.message || 'Failed to save customer');
      }
    } catch (err) {
      alert('Network error. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseForm = () => {
    if (form.customer_name || form.mobile_no || form.email_id) {
      if (window.confirm('Discard unsaved changes?')) {
        setShowForm(false);
        setForm({ customer_name: '', mobile_no: '', email_id: '' });
      }
    } else {
      setShowForm(false);
    }
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Users className="w-8 h-8 text-gray-600" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
                <p className="text-sm text-gray-500 mt-1">{total} customers</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Customer
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-6 pb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={filterName}
                onChange={e => {
                  setFilterName(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search customers by name..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading customers...</p>
              </div>
            ) : paginated.length === 0 ? (
              <div className="text-center py-20">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {filterName ? 'No customers found' : 'No customers yet'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {filterName ? 'Try adjusting your search.' : 'Start by adding your first customer.'}
                </p>
                {!filterName && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5" />
                    Add First Customer
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Customer Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Mobile
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginated.map(c => (
                        <tr key={c.value} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{c.label}</div>
                          </td>
                          <td className="px-6 py-4">
                            {c.mobile ? (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span>{c.mobile}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {c.email ? (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span>{c.email}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(currentPage * pageSize, total)} of {total} customers
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Rows per page:</span>
                    <div className="flex gap-2">
                      {[20, 50, 100].map(size => (
                        <button
                          key={size}
                          onClick={() => {
                            setPageSize(size);
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                            pageSize === size
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ────── FULL-SCREEN ADD CUSTOMER FORM (MODAL STYLE) ────── */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Form Header */}
              <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleCloseForm}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">New Customer</h2>
                    <p className="text-sm text-gray-500 mt-1">Fill in the details below</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Form Body */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={form.customer_name}
                      onChange={e => setForm({ ...form, customer_name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="Enter customer name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={form.mobile_no}
                      onChange={e => setForm({ ...form, mobile_no: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="+91 98765 43210"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={form.email_id}
                      onChange={e => setForm({ ...form, email_id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="customer@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div className="px-8 py-6 border-t border-gray-200 flex justify-end gap-4">
                <button
                  onClick={handleCloseForm}
                  className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.customer_name.trim()}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {saving && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>}
                  {saving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default CustomerList;