import React, { useState, useEffect } from 'react';
import { Loader2, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import DataTable from './DataTable';
import ReportFilters from './ReportFilters';

function SalesReport() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ from_date: '', to_date: '', customer: '' });
  const [customers, setCustomers] = useState([]);

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  useEffect(() => {
    fetchCustomers();
    fetchReport();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_PATH}.get_customers_list_rpt`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Frappe usually wraps in "message"
      setCustomers((json.message || json.data || json) || []);
    } catch (err) {
      console.error('Customers fetch error:', err);
    }
  };

  const fetchReport = async (filters = {}) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const params = new URLSearchParams(filters);
      const res = await fetch(`${API_PATH}.get_sales_report?${params.toString()}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();

      // CRITICAL FIX: Handle both {message: {...}} and direct object
      const payload = result.message || result;

      if (payload.status === 'success') {
        setData(payload.data || []);
        setColumns(payload.columns || []);
        setSuccess('Report loaded successfully');
      } else {
        setError(payload.message || payload.error || 'Unknown error from server');
      }
    } catch (err) {
      setError('Network or server error: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    fetchReport(newFilters);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-slate-700" /> Sales Report
          </h1>
          <p className="text-slate-600 mt-2">POS Invoice Summary</p>
        </div>

        {/* NEVER render raw objects! */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        <ReportFilters
          onFilterChange={handleFilterChange}
          initialFilters={filters}
          customers={customers}
          reportType="sales"
        />

        <DataTable
          columns={columns}
          data={data}
          title="Sales Report"
          loading={loading}
        />
      </div>
    </div>
  );
}

export default SalesReport;