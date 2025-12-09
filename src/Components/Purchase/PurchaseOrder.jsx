import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { AlertCircle, CheckCircle2, Loader2, FileText, Calendar, Package, DollarSign, ShoppingCart } from 'lucide-react';
import CustomSearchDropdown from './CustomSearchDropdown';

const POItemModel = {
  item_code: null,
  item_name: '',
  schedule_date: '',
  qty: 1,
  stock_uom: '',
  uom: '',
  rate: 0,
  amount: 0
};

function PurchaseOrder() {
  const [formData, setFormData] = useState({
    supplier: null,
    transaction_date: new Date().toISOString().slice(0, 16),
    company: localStorage.getItem('company') || '',
    currency: 'AED',
    conversion_rate: 1.0,
    set_warehouse: '',
    items: [{
      ...POItemModel,
      schedule_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().slice(0, 16)
    }],
    total_qty: 0,
    total: 0
  });

  const [warehouses, setWarehouses] = useState([]);
  const [history, setHistory] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [allItems, setAllItems] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const [activeDropdownRow, setActiveDropdownRow] = useState(null);

  const getSession = () => localStorage.getItem('session') || '';
  const API_PATH = '/api/method/custom_retailpos.custom_retailpos.retail_api.retail';

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`${API_PATH}.get_warehouses`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setWarehouses(data.message || []);
    } catch (err) {
      setError('Failed to load warehouses');
    }
  };

  const handleInputChange = (e, rowIndex = null) => {
    const { name, value } = e.target;
    if (rowIndex !== null) {
      const items = [...formData.items];
      if (name === 'qty' || name === 'rate') {
        items[rowIndex][name] = parseFloat(value) || 0;
        items[rowIndex].amount = (items[rowIndex].qty || 0) * (items[rowIndex].rate || 0);
      } else if (name === 'schedule_date') {
        if (value < formData.transaction_date) {
          setError('Schedule date cannot be before transaction date');
          return;
        } else {
          setError('');
        }
        items[rowIndex][name] = value;
      } else {
        items[rowIndex][name] = value;
      }
      setFormData({ ...formData, items });
    } else {
      if (name === 'transaction_date') {
        setError('');
        const items = formData.items.map(item => ({
          ...item,
          schedule_date: item.schedule_date < value ? value : item.schedule_date
        }));
        setFormData({ ...formData, [name]: value, items });
      } else {
        setFormData({ ...formData, [name]: value });
      }
    }
    calculateTotals();
  };

  const calculateTotals = () => {
    const totalQty = formData.items.reduce((sum, item) => sum + (item.qty || 0), 0);
    const total = formData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    setFormData(prev => ({ ...prev, total_qty: totalQty, total }));
  };

  const addItemRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...POItemModel, schedule_date: prev.transaction_date }]
    }));
  };

  const removeItemRow = (index) => {
    const items = formData.items.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, items }));
    calculateTotals();
  };

  const fetchHistory = async () => {
    const itemCodes = formData.items.map(item => item.item_code).filter(Boolean);
    if (!itemCodes.length) {
      setHistory({});
      return;
    }
    try {
      const res = await fetch(`${API_PATH}.get_po_history?item_codes_json=${JSON.stringify(itemCodes)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHistory(data.message || {});
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
    calculateTotals();
  }, [formData.items]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.supplier?.name || !formData.company) {
      setError('Please select supplier and company');
      return;
    }
    if (formData.items.some(i => !i.item_code || !i.uom || i.qty <= 0)) {
      setError('All items must have item, UOM and valid qty');
      return;
    }
    if (formData.items.some(i => i.schedule_date < formData.transaction_date)) {
      setError('Schedule date cannot be before transaction date');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...formData,
        supplier: formData.supplier.name,
      };
      delete payload.total_qty;
      delete payload.total;

      const res = await fetch(`${API_PATH}.create_purchase_order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Frappe-SID': getSession() },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const apiResp = data.message || data;

      if (apiResp.status === 'success') {
        setSuccess(`PO ${apiResp.name} created! Total: AED ${apiResp.grand_total?.toFixed(2) || formData.total.toFixed(2)}`);
        setFormData(prev => ({
          ...prev,
          items: [{ ...POItemModel, schedule_date: prev.transaction_date }],
          total_qty: 0,
          total: 0
        }));
      } else {
        setError(apiResp.message || 'Failed');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // SUPPLIER: Fixed with Type Dropdown
  const handleSupplierSelect = (supplier) => {
    setFormData(prev => ({ ...prev, supplier }));
  };

  const handleSupplierCreate = async (name) => {
    const typeSelect = document.getElementById('new-supplier-type');
    const supplier_type = typeSelect ? typeSelect.value : "Company";

    try {
      const res = await fetch(`${API_PATH}.create_supplier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-SID': getSession()
        },
        credentials: 'include',
        body: JSON.stringify({
          supplier_name: name.trim(),
          supplier_type
        })
      });

      const result = await res.json();

      // FORMAT 1: { message: { status: "success", message: { ... } } }
      if (result.message?.status === 'success' && result.message?.message) {
        const s = result.message.message;
        return {
          name: s.name,
          supplier_name: s.supplier_name || s.name,
          supplier_type: s.supplier_type || supplier_type
        };
      }

      // FORMAT 2: { status: "success", message: { ... } }
      if (result.status === 'success' && result.message) {
        const s = result.message;
        return {
          name: s.name,
          supplier_name: s.supplier_name || s.name,
          supplier_type: s.supplier_type || supplier_type
        };
      }

      // FORMAT 3: { message: [ { name: "...", supplier_name: "..." } ] }
      if (Array.isArray(result.message) && result.message[0]) {
        const s = result.message[0];
        return {
          name: s.name,
          supplier_name: s.supplier_name || s.name,
          supplier_type: s.supplier_type || supplier_type
        };
      }

      // FAILURE
      throw new Error('Invalid response from server');

    } catch (err) {
      setError(`Cannot create supplier: ${err.message}`);
      throw err;
    }
  };


  const fetchSuppliers = async (query) => {
    try {
      const res = await fetch(`${API_PATH}.get_suppliers_po?query=${encodeURIComponent(query)}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.message || []).map(s => ({
        name: s.name,
        supplier_name: s.supplier_name || s.name
      }));
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  // ITEM HANDLERS
  const handleItemSelect = (item, rowIndex) => {
    const items = [...formData.items];
    items[rowIndex] = {
      ...items[rowIndex],
      item_code: item.item_code,
      item_name: item.item_name,
      stock_uom: item.stock_uom || '',
      uom: item.stock_uom || '',
      rate: item.rate || 0,
      amount: (item.rate || 0) * (items[rowIndex].qty || 1),
      schedule_date: items[rowIndex].schedule_date || formData.transaction_date
    };
    setFormData({ ...formData, items });
    calculateTotals();
  };

  const fetchItems = async (query) => {
    try {
      const res = await fetch(`${API_PATH}.get_items_for_po?query=${query}`, {
        headers: { 'X-Frappe-SID': getSession() },
        credentials: 'include'
      });
      if (!res.ok) return [];
      const data = await res.json();

      const itemsWithRate = await Promise.all(
        (data.message || []).map(async (item) => {
          if (!item.rate) {
            try {
              const rateRes = await fetch(`${API_PATH}.get_item_selling_rate_po?item_code=${item.item_code}`, {
                headers: { 'X-Frappe-SID': getSession() },
                credentials: 'include'
              });
              const rateData = await rateRes.json();
              item.rate = rateData.message?.rate || 0;
            } catch (err) {
              item.rate = 0;
            }
          }
          return item;
        })
      );

      setAllItems(itemsWithRate);
      return itemsWithRate;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  if (!formData.company) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xl">Company missing. Login again.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-slate-700" /> Purchase Order
          </h1>
          <p className="text-slate-600 mt-2">Create a new purchase order</p>
        </div>

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

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            {/* SUPPLIER WITH TYPE DROPDOWN */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Supplier *</label>
              <CustomSearchDropdown
                placeholder="Search or create supplier..."
                value={formData.supplier}
                onSelect={handleSupplierSelect}
                fetchData={fetchSuppliers}
                createOption={handleSupplierCreate}
                optionsLabel="supplier_name"
                extraCreateFields={() => (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Supplier Type</label>
                    <select id="new-supplier-type" className="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-slate-500" defaultValue="Company">
                      <option value="Company">Company</option>
                      <option value="Individual">Individual</option>
                      <option value="Partnership">Partnership</option>
                    </select>
                  </div>
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Transaction Date *</label>
              <input
                type="datetime-local"
                name="transaction_date"
                value={formData.transaction_date}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Company *</label>
              <input type="text" value={formData.company} readOnly className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Warehouse</label>
              <select name="set_warehouse" value={formData.set_warehouse} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500">
                <option value="">Select Warehouse</option>
                {warehouses.map(wh => <option key={wh.name} value={wh.name}>{wh.warehouse_name}</option>)}
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2"><Package className="w-5 h-5" /> Items</h2>
              <button type="button" onClick={addItemRow} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800">Add Item</button>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4">Item</th>
                    <th className="text-left py-3 px-4">Schedule Date</th>
                    <th className="text-right py-3 px-4">Qty</th>
                    <th className="text-left py-3 px-4">UOM</th>
                    <th className="text-right py-3 px-4">Rate</th>
                    <th className="text-right py-3 px-4">Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.items.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-3 px-4">
                        <div className="relative">
                          <input
                            type="text"
                            value={item.item_name || ''}
                            onChange={async (e) => {
                              const q = e.target.value;
                              const items = [...formData.items];
                              items[idx].item_name = q; // Show typed text
                              setFormData({ ...formData, items });

                              if (q.length < 2) {
                                setAllItems([]);
                                setActiveDropdownRow(null);
                                return;
                              }

                              try {
                                const res = await axios.get(`${API_PATH}.get_items_for_po`, {
                                  params: { query: q },
                                  withCredentials: true,
                                  headers: { 'X-Frappe-SID': getSession() }
                                });
                                const fetched = res.data.message || [];
                                setAllItems(fetched);
                                setActiveDropdownRow(idx);

                                const rect = e.target.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + window.scrollY + 8,
                                  left: rect.left + window.scrollX,
                                  width: rect.width
                                });
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            onFocus={(e) => {
                              if (item.item_name && allItems.length === 0) {
                                const rect = e.target.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + window.scrollY + 8,
                                  left: rect.left + window.scrollX,
                                  width: rect.width
                                });
                                setActiveDropdownRow(idx);
                              }
                            }}
                            placeholder="Search item..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />

                          {/* PORTAL DROPDOWN — ONLY FOR ITEMS TABLE */}
                          {activeDropdownRow === idx && dropdownPosition && allItems.length > 0 && createPortal(
                            <div
                              className="fixed bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] max-h-64 overflow-y-auto"
                              style={{
                                top: `${dropdownPosition.top}px`,
                                left: `${dropdownPosition.left}px`,
                                width: `${dropdownPosition.width}px`
                              }}
                            >
                              {allItems.map((it) => (
                                <div
                                  key={it.item_code}
                                  onClick={() => {
                                    handleItemSelect(it, idx);
                                    setActiveDropdownRow(null);
                                    setDropdownPosition(null);
                                  }}
                                  className="px-5 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                                >
                                  <div className="font-medium text-gray-900">{it.item_name}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {it.item_code} • Rate: AED {(it.rate || 0).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                            </div>,
                            document.body
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input type="datetime-local" value={item.schedule_date} min={formData.transaction_date} onChange={(e) => handleInputChange(e, idx)} name="schedule_date" className="w-full px-2 py-1 border rounded text-sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input type="number" value={item.qty} onChange={(e) => handleInputChange(e, idx)} name="qty" min="0.01" step="0.01" className="w-20 text-right border rounded px-2 py-1" />
                      </td>
                      <td className="py-3 px-4">
                        <input type="text" value={item.uom} readOnly className="w-full px-2 py-1 bg-slate-100 rounded text-sm" placeholder="Auto" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input type="number" value={item.rate} onChange={(e) => handleInputChange(e, idx)} name="rate" min="0" step="0.01" className="w-24 text-right border rounded px-2 py-1" />
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">AED {item.amount.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <button type="button" onClick={() => removeItemRow(idx)} className="text-red-600 text-xl">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white mb-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><DollarSign className="w-6 h-6" /> Summary</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-slate-300">Total Quantity</p>
                <p className="text-2xl font-bold">{formData.total_qty.toFixed(2)}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-slate-300">Grand Total</p>
                <p className="text-2xl font-bold">AED {formData.total.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-3 disabled:opacity-50">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
            {loading ? 'Creating...' : 'Create Purchase Order'}
          </button>
        </form>

        {/* History */}
        {Object.keys(history).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ShoppingCart className="w-6 h-6" /> Recent PO History</h2>
            {Object.entries(history).map(([code, entries]) => (
              <div key={code} className="mb-4 p-4 bg-slate-50 rounded">
                <p className="font-medium">Item: {code}</p>
                <table className="w-full mt-2 text-sm">
                  {entries.slice(0, 3).map((e, i) => (
                    <tr key={i}><td className="py-1">{e.parent}</td><td className="text-right">{e.qty}</td><td className="text-right">AED {parseFloat(e.rate).toFixed(2)}</td></tr>
                  ))}
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PurchaseOrder;