// src/pages/ItemPriceList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, ChevronDown, Search, X, Save, Upload, Menu, MoreVertical, Copy, Trash2, Loader2, Check
} from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';

function ItemPriceList() {
  /* ────────────────────── STATE ────────────────────── */
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filterItemCode, setFilterItemCode] = useState('');
  const [filterItemName, setFilterItemName] = useState('');
  const [filterPriceList, setFilterPriceList] = useState('');

  // Full-screen Form
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
    note: '',
    image: null,
    imagePreview: null
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Item Search Dropdown
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [itemLoading, setItemLoading] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const dropdownRef = useRef(null);

  /* ────────────────────── FETCH PRICES ────────────────────── */
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_price_list',
          { withCredentials: true }
        );
        setPrices(res.data.message || []);
      } catch (err) {
        alert('Failed to load prices');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  /* ────────────────────── ITEM SEARCH (DEBOUNCED) ────────────────────── */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (itemSearch.trim()) fetchItems(itemSearch);
      else setItems([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  const fetchItems = async (q) => {
    setItemLoading(true);
    try {
      const res = await axios.get(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_items',
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

  /* ────────────────────── FILTER & PAGINATION ────────────────────── */
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

  /* ────────────────────── IMAGE HANDLING ────────────────────── */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({
          ...form,
          image: reader.result.split(',')[1],
          imagePreview: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setForm({ ...form, image: null, imagePreview: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ────────────────────── SAVE (UPSERT) ────────────────────── */
  const handleSave = async () => {
    if (!form.item_code || !form.price_list || !form.rate) {
      alert('Item Code, Price List, and Rate are required.');
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
        note: form.note || null,
        image: form.image || ''
      };

      const res = await axios.post(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item_price',
        payload,
        { withCredentials: true }
      );

      if (res.data.success) {
        alert(res.data.message);
        setShowForm(false);
        setForm({
          item_code: '', item_name: '', uom: 'Nos', packing_unit: 0,
          price_list: 'Standard Selling', buying: false, selling: true,
          customer: '', batch_no: '', currency: 'AED', rate: 0,
          valid_from: '', valid_upto: '', lead_time_days: 0, note: '', image: null, imagePreview: null
        });

        const refresh = await axios.get(
          '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_price_list',
          { withCredentials: true }
        );
        setPrices(refresh.data.message || []);
      } else {
        alert(res.data.message);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /* ────────────────────── UI ────────────────────── */
  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-gray-900">Item Price</h1>
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
            <span>Add Price</span>
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
                      {[
                        { label: 'Item Code', state: filterItemCode, setState: setFilterItemCode },
                        { label: 'Item Name', state: filterItemName, setState: setFilterItemName },
                        { label: 'Price List', state: filterPriceList, setState: setFilterPriceList },
                      ].map((col, i) => (
                        <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          <div className="space-y-1">
                            <span>{col.label}</span>
                            <div className="relative">
                              <Search className="absolute left-2 top-2 w-3 h-3 text-gray-400" />
                              <input
                                type="text"
                                value={col.state}
                                onChange={e => col.setState(e.target.value)}
                                placeholder="Filter..."
                                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md"
                              />
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated On</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginated.length === 0 ? (
                      <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No prices found</td></tr>
                    ) : (
                      paginated.map(p => (
                        <tr key={p.name} className="hover:bg-gray-50">
                          <td className="px-6 py-4"><input type="checkbox" className="rounded border-gray-300" /></td>
                          <td className="px-6 py-4 text-sm text-gray-900">{p.item_code}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.item_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{p.price_list}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{p.price_list_rate}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{p.reference || '—'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(p.modified).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-3 flex items-center justify-between border-t">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total}
                </div>
                <div className="flex space-x-2">
                  {[20, 100, 500, 2500].map(size => (
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

        {/* ────── FULL-SCREEN FORM (Same as ItemList) ────── */}
        {showForm && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowForm(false)} className="text-gray-600 hover:text-gray-900">
                  <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold text-gray-900">New Item Price</h1>
                <span className="text-sm text-orange-600">Not Saved</span>
              </div>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1">
                  <span>View</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1">
                  <span>Actions</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900">
                  <Copy className="w-4 h-4" />
                </button>
                <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-1"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* LEFT COLUMN */}
                  <div className="space-y-5" ref={dropdownRef}>

                    {/* Item Code (Searchable Dropdown) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Code <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowItemDropdown(!showItemDropdown)}
                          className="w-full px-3 py-2 text-left border border-gray-300 rounded-md flex items-center justify-between focus:ring-1 focus:ring-blue-500"
                        >
                          <span className={form.item_code ? 'text-gray-900' : 'text-gray-400'}>
                            {form.item_code || 'Select Item...'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>

                        {showItemDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                            <div className="p-2 border-b">
                              <div className="relative">
                                <Search className="absolute left-2 top-2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Search items..."
                                  value={itemSearch}
                                  onChange={e => setItemSearch(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              {itemLoading ? (
                                <div className="p-3 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-500" /></div>
                              ) : items.length === 0 ? (
                                <div className="p-3 text-center text-sm text-gray-500">
                                  {itemSearch ? 'No items found' : 'Type to search...'}
                                </div>
                              ) : (
                                items.map(item => (
                                  <button
                                    key={item.name}
                                    onClick={() => handleItemSelect(item)}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex justify-between text-sm border-b last:border-b-0"
                                  >
                                    <div>
                                      <div className="font-medium text-gray-900">{item.item_code}</div>
                                      <div className="text-xs text-gray-500">{item.item_name}</div>
                                    </div>
                                    {form.item_code === item.item_code && <Check className="w-4 h-4 text-green-600" />}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Item Name (Read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                      <input
                        type="text"
                        value={form.item_name}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                    </div>

                    {/* UOM (Read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        UOM <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.uom}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                    </div>

                    {/* Item Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Description</label>
                      <input
                        type="text"
                        value={form.item_name}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                    </div>

                    {/* Packing Unit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Packing Unit</label>
                      <input
                        type="number"
                        value={form.packing_unit}
                        onChange={e => setForm({ ...form, packing_unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <p className="text-xs text-gray-500 mt-1">Quantity that must be bought or sold per UOM</p>
                    </div>

                    {/* Price List */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price List <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.price_list}
                        onChange={e => setForm({ ...form, price_list: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Standard Selling"
                      />
                    </div>

                    {/* Buying / Selling */}
                    <div className="flex items-center space-x-6">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={form.buying && !form.selling}
                          onChange={() => setForm({ ...form, buying: true, selling: false })}
                          className="mr-2"
                        />
                        <span className="text-sm">Buying</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={!form.buying && form.selling}
                          onChange={() => setForm({ ...form, buying: false, selling: true })}
                          className="mr-2"
                        />
                        <span className="text-sm">Selling</span>
                      </label>
                    </div>

                    {/* Customer */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                      <input
                        type="text"
                        value={form.customer}
                        onChange={e => setForm({ ...form, customer: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    {/* Batch No */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Batch No</label>
                      <input
                        type="text"
                        value={form.batch_no}
                        onChange={e => setForm({ ...form, batch_no: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-5">

                    {/* Currency */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <input
                        type="text"
                        value={form.currency}
                        onChange={e => setForm({ ...form, currency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="AED"
                      />
                    </div>

                    {/* Rate */}
                    <div>
                      <label className="block text-sm font-medium text-gray-

700 mb-1">
                        Rate <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.rate}
                        onChange={e => setForm({ ...form, rate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    {/* Valid From */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                      <input
                        type="date"
                        value={form.valid_from}
                        onChange={e => setForm({ ...form, valid_from: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    {/* Valid Upto */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Valid Upto</label>
                      <input
                        type="date"
                        value={form.valid_upto}
                        onChange={e => setForm({ ...form, valid_upto: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    {/* Lead Time in days */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time in days</label>
                      <input
                        type="number"
                        value={form.lead_time_days}
                        onChange={e => setForm({ ...form, lead_time_days: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea
                    rows={4}
                    value={form.note}
                    onChange={e => setForm({ ...form, note: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none"
                    placeholder="Any additional information..."
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

export default ItemPriceList;