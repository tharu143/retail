// src/pages/CustomerList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, ChevronDown, Search, Save, Menu, Loader2, Phone, Mail
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

  // Correct API Path
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
        alert('Failed to load customers');
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

        // Refresh list
        const refresh = await fetch(`${API_PATH}.get_customers`, {
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
      } else {
        alert(result.message?.message || 'Failed to save');
      }
    } catch (err) {
      alert('Failed to save customer');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <span>List View</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>

        {/* Table */}
        <main className="p-6">
          {loading ? (
            <div className="text-center py-10">Loading…</div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <div className="space-y-1">
                          <span>Name</span>
                          <div className="relative">
                            <Search className="absolute left-2 top-2 w-3 h-3 text-gray-400" />
                            <input
                              type="text"
                              value={filterName}
                              onChange={e => setFilterName(e.target.value)}
                              placeholder="Filter..."
                              className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md"
                            />
                          </div>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mobile</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginated.length === 0 ? (
                      <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No customers found</td></tr>
                    ) : (
                      paginated.map(c => (
                        <tr key={c.value} className="hover:bg-gray-50">
                          <td className="px-6 py-4"><input type="checkbox" className="rounded border-gray-300" /></td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.label}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {c.mobile ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.mobile}</span> : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {c.email ? <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span> : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-3 flex items-center justify-between border-t">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}
                </div>
                <div className="flex space-x-2">
                  {[20, 100, 500].map(size => (
                    <button
                      key={size}
                      onClick={() => { setPageSize(size); setCurrentPage(1); }}
                      className={`px-3 py-1 text-sm rounded-md ${pageSize === size ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ────── FULL‑SCREEN CREATE FORM ────── */}
        {showForm && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col">
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowForm(false)} className="text-gray-600 hover:text-gray-900">
                  <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold text-gray-900">New Customer</h1>
                <span className="text-sm text-orange-600">Not Saved</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-1"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={e => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile No</label>
                  <input
                    type="text"
                    value={form.mobile_no}
                    onChange={e => setForm({ ...form, mobile_no: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    placeholder="+971 50 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email_id}
                    onChange={e => setForm({ ...form, email_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default CustomerList;