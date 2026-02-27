// src/pages/ItemPriceList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, ChevronLeft, Tag, AlertCircle,
  ChevronDown
} from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';

function ItemPriceList() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filterItemCode, setFilterItemCode] = useState('');
  const [filterItemName, setFilterItemName] = useState('');
  const [filterPriceList, setFilterPriceList] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    item_code: '',
    item_name: '',
    uom: 'Nos',
    packing_unit: 0,
    price_list: 'Standard Selling',
    buying: false,
    selling: true,
    customer: '',
    batch_no: '',
    currency: 'AED',
    rate: 0,
    valid_from: '',
    valid_upto: '',
    lead_time_days: 0,
    note: ''
  });
  const [saving, setSaving] = useState(false);

  // Item Search
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemLoading, setItemLoading] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const dropdownRef = useRef(null);

  /* ==================== FETCH PRICES ==================== */
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          'http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_price_list',
          { withCredentials: true }
        );
        setPrices(res.data.message || []);
      } catch (err) {
        alert('Failed to load item prices');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  /* ==================== ITEM SEARCH ==================== */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (itemSearch.trim().length >= 2) {
        fetchItems(itemSearch);
      } else {
        setItems([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  const fetchItems = async (q) => {
    setItemLoading(true);
    try {
      const res = await axios.get(
        'http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items',
        { params: { q }, withCredentials: true }
      );
      setItems(res.data.message || []);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setItemLoading(false);
    }
  };

  const handleItemSelect = (item) => {
    setForm({
      ...form,
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.uom || 'Nos'
    });
    setItemSearch('');
    setShowItemDropdown(false);
  };

  /* ==================== FILTERING ==================== */
  const filteredPrices = useMemo(() => {
    return prices.filter(p => {
      const code = !filterItemCode || p.item_code.toLowerCase().includes(filterItemCode.toLowerCase());
      const name = !filterItemName || p.item_name.toLowerCase().includes(filterItemName.toLowerCase());
      const list = !filterPriceList || p.price_list.toLowerCase().includes(filterPriceList.toLowerCase());
      return code && name && list;
    });
  }, [prices, filterItemCode, filterItemName, filterPriceList]);

  const total = filteredPrices.length;
  const paginated = filteredPrices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ==================== SAVE ==================== */
  const handleSave = async () => {
    if (!form.item_code || !form.price_list || !form.rate || form.rate <= 0) {
      alert('Please fill required fields: Item, Price List, and valid Rate.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        item_code: form.item_code,
        price_list: form.price_list,
        price_list_rate: parseFloat(form.rate),
        buying: form.buying ? 1 : 0,
        selling: form.selling ? 1 : 0,
        currency: form.currency,
        uom: form.uom,
        valid_from: form.valid_from || null,
        valid_upto: form.valid_upto || null,
        batch_no: form.batch_no || null,
        customer: form.customer || null,
        lead_time_days: parseInt(form.lead_time_days) || 0,
        packing_unit: parseInt(form.packing_unit) || 0,
        note: form.note || null
      };

      const res = await axios.post(
        'http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item_price',
        payload,
        { withCredentials: true }
      );

      if (res.data.success || res.data.message?.success) {
        alert('Item price saved successfully!');
        setShowForm(false);
        resetForm();
        // Refresh list
        const refresh = await axios.get(
          'http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_price_list',
          { withCredentials: true }
        );
        setPrices(refresh.data.message || []);
        setCurrentPage(1);
      } else {
        alert(res.data.message || 'Failed to save');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      item_code: '', item_name: '', uom: 'Nos', packing_unit: 0,
      price_list: 'Standard Selling', buying: false, selling: true,
      customer: '', batch_no: '', currency: 'AED', rate: 0,
      valid_from: '', valid_upto: '', lead_time_days: 0, note: ''
    });
  };

  const handleCloseForm = () => {
    const hasChanges = form.item_code || form.rate > 0 || form.price_list !== 'Standard Selling';
    if (hasChanges && !window.confirm('Discard unsaved changes?')) return;
    setShowForm(false);
    resetForm();
  };

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">

        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Tag className="w-8 h-8 text-gray-600" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Item Prices</h1>
                <p className="text-sm text-gray-500 mt-1">{total} price records</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Price
            </button>
          </div>

          {/* Global Search */}
          <div className="px-6 pb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by item code, name or price list..."
                value={filterItemCode || filterItemName || filterPriceList}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterItemCode(val);
                  setFilterItemName(val);
                  setFilterPriceList(val);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading item prices...</p>
              </div>
            ) : paginated.length === 0 ? (
              <div className="text-center py-20">
                <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {total === 0 ? 'No item prices yet' : 'No prices match your search'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {total === 0 ? 'Start by adding pricing for your items.' : 'Try adjusting your search.'}
                </p>
                {total === 0 && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5" />
                    Add First Price
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item Code</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price List</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Currency</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginated.map(p => (
                        <tr key={p.name} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.item_code}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{p.item_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{p.price_list}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {parseFloat(p.price_list_rate).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{p.currency || 'AED'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(p.modified).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} prices
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Rows per page:</span>
                    <div className="flex gap-2">
                      {[20, 50, 100].map(size => (
                        <button
                          key={size}
                          onClick={() => { setPageSize(size); setCurrentPage(1); }}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${pageSize === size ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-100'
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

        {/* ==================== ADD PRICE MODAL ==================== */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col my-8">
              {/* Header */}
              <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleCloseForm}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">New Item Price</h2>
                    <p className="text-sm text-gray-500 mt-1">Set pricing for an item</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                    {/* Left Column */}
                    <div className="space-y-6">
                      {/* Item Search */}
                      <div ref={dropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Item <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowItemDropdown(!showItemDropdown)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex justify-between items-center hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
                          >
                            <span className={form.item_code ? 'text-gray-900' : 'text-gray-500'}>
                              {form.item_code ? `${form.item_code} - ${form.item_name}` : 'Search and select item...'}
                            </span>
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          </button>

                          {showItemDropdown && (
                            <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden">
                              <div className="p-3 border-b border-gray-200">
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="Type at least 2 characters..."
                                    value={itemSearch}
                                    onChange={e => setItemSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto">
                                {itemLoading ? (
                                  <div className="p-8 text-center text-gray-500">Searching...</div>
                                ) : items.length === 0 ? (
                                  <div className="p-8 text-center text-gray-500">
                                    {itemSearch.length < 2 ? 'Type to search items' : 'No items found'}
                                  </div>
                                ) : (
                                  items.map(item => (
                                    <button
                                      key={item.name}
                                      onClick={() => handleItemSelect(item)}
                                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex justify-between items-center"
                                    >
                                      <div>
                                        <div className="font-medium text-gray-900">{item.item_code}</div>
                                        <div className="text-sm text-gray-600">{item.item_name}</div>
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* UOM (readonly) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">UOM</label>
                        <input
                          type="text"
                          value={form.uom}
                          readOnly
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                        />
                      </div>

                      {/* Price List */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Price List <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.price_list}
                          onChange={e => setForm({ ...form, price_list: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="Standard Selling">Standard Selling</option>
                          <option value="Standard Buying">Standard Buying</option>
                        </select>
                      </div>

                      {/* Type: Buying / Selling */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Price Type</label>
                        <div className="flex gap-8">
                          <label className="flex items-center gap-3">
                            <input
                              type="radio"
                              checked={form.buying && !form.selling}
                              onChange={() => setForm({ ...form, buying: true, selling: false })}
                              className="w-5 h-5 text-blue-600"
                            />
                            <span className="font-medium">Buying</span>
                          </label>
                          <label className="flex items-center gap-3">
                            <input
                              type="radio"
                              checked={!form.buying && form.selling}
                              onChange={() => setForm({ ...form, buying: false, selling: true })}
                              className="w-5 h-5 text-blue-600"
                            />
                            <span className="font-medium">Selling</span>
                          </label>
                        </div>
                      </div>

                      {/* Packing Unit */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Packing Unit</label>
                        <input
                          type="number"
                          min="0"
                          value={form.packing_unit}
                          onChange={e => setForm({ ...form, packing_unit: Number(e.target.value) || 0 })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-2">Minimum quantity per transaction (optional)</p>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Rate <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.rate}
                          onChange={e => setForm({ ...form, rate: Number(e.target.value) || 0 })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 text-lg font-semibold"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                        <input
                          type="text"
                          value={form.currency}
                          onChange={e => setForm({ ...form, currency: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500"
                          placeholder="AED"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Valid From</label>
                          <input
                            type="date"
                            value={form.valid_from}
                            onChange={e => setForm({ ...form, valid_from: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Valid Upto</label>
                          <input
                            type="date"
                            value={form.valid_upto}
                            onChange={e => setForm({ ...form, valid_upto: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Lead Time (days)</label>
                        <input
                          type="number"
                          min="0"
                          value={form.lead_time_days}
                          onChange={e => setForm({ ...form, lead_time_days: Number(e.target.value) || 0 })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Customer (optional)</label>
                        <input
                          type="text"
                          value={form.customer}
                          onChange={e => setForm({ ...form, customer: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500"
                          placeholder="Specific customer pricing"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Batch No (optional)</label>
                        <input
                          type="text"
                          value={form.batch_no}
                          onChange={e => setForm({ ...form, batch_no: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Note (optional)</label>
                    <textarea
                      rows={4}
                      value={form.note}
                      onChange={e => setForm({ ...form, note: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      placeholder="Any additional pricing notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t border-gray-200 flex justify-end gap-4 bg-gray-50">
                <button
                  onClick={handleCloseForm}
                  className="px-6 py-3 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.item_code || !form.price_list || form.rate <= 0}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {saving && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>}
                  {saving ? 'Saving...' : 'Save Price'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ItemPriceList;