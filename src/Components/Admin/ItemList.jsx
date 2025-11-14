// src/pages/ItemList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, ChevronDown, Search, X, Save, Upload, Menu, MoreVertical, Copy, Trash2 } from 'lucide-react';
import axios from 'axios';
import NavBar from '../Nav/NavBar';

function ItemList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [filterId, setFilterId] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHasVariants, setFilterHasVariants] = useState('');
  const [filterLastUpdated, setFilterLastUpdated] = useState('');

  // Form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    item_code: '',
    item_name: '',
    item_group: '',
    disabled: false,
    allow_alternative_item: false,
    maintain_stock: true,
    has_variants: false,
    opening_stock: 0,
    valuation_rate: 0,
    standard_selling_rate: 0,
    is_fixed_asset: false,
    is_zero_rated: false,
    is_exempt: false,
    default_uom: 'Nos',
    tax_code: '',
    description: '',
    image: null,
    imagePreview: null
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Item Groups
  const [itemGroups, setItemGroups] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupLoading, setGroupLoading] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  // Fetch Items
  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details',
          { withCredentials: true }
        );
        setItems(res.data.message || []);
      } catch (err) {
        alert('Failed to load items');
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  // Fetch Item Groups (debounced)
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchItemGroups(groupSearch);
    }, 300);
    return () => clearTimeout(delay);
  }, [groupSearch]);

  const fetchItemGroups = async (search = '') => {
    setGroupLoading(true);
    try {
      const res = await axios.get(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups',
        {
          params: { search },
          withCredentials: true
        }
      );
      if (res.data.message.success) {
        setItemGroups(res.data.message.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGroupLoading(false);
    }
  };

  // Filter Logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const id = !filterId || item.item_code.toLowerCase().includes(filterId.toLowerCase());
      const name = !filterName || item.item_name.toLowerCase().includes(filterName.toLowerCase());
      const group = !filterGroup || item.item_group.toLowerCase().includes(filterGroup.toLowerCase());
      const status = !filterStatus || (filterStatus === 'Enabled' ? !item.disabled : item.disabled);
      const variants = !filterHasVariants || (filterHasVariants === 'Yes' ? item.has_variants : !item.has_variants);
      const date = !filterLastUpdated || new Date(item.modified).toLocaleDateString().includes(filterLastUpdated);
      return id && name && group && status && variants && date;
    });
  }, [items, filterId, filterName, filterGroup, filterStatus, filterHasVariants, filterLastUpdated]);

  const total = filteredItems.length;
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Image
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

  // Create Item
  const handleCreate = async () => {
    if (!form.item_code || !form.item_name || !form.item_group || !form.default_uom) {
      alert('Item Code, Item Name, Item Group, and Default UOM are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        disabled: form.disabled ? 1 : 0,
        allow_alternative_item: form.allow_alternative_item ? 1 : 0,
        maintain_stock: form.maintain_stock ? 1 : 0,
        has_variants: form.has_variants ? 1 : 0,
        is_fixed_asset: form.is_fixed_asset ? 1 : 0,
        is_zero_rated: form.is_zero_rated ? 1 : 0,
        is_exempt: form.is_exempt ? 1 : 0,
        image: form.image || ''
      };

      const res = await axios.post(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item',
        payload,
        { withCredentials: true }
      );

      if (res.data.message.success) {
        alert(res.data.message.message);
        setShowForm(false);
        setForm({
          item_code: '', item_name: '', item_group: '', disabled: false,
          allow_alternative_item: false, maintain_stock: true, has_variants: false,
          opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0,
          is_fixed_asset: false, is_zero_rated: false, is_exempt: false,
          default_uom: 'Nos', tax_code: '', description: '', image: null, imagePreview: null
        });
        const refresh = await axios.get(
          '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details',
          { withCredentials: true }
        );
        setItems(refresh.data.message || []);
      }
    } catch (err) {
      alert(err.response?.data?.message?.message || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const selectedGroupLabel = itemGroups.find(g => g.value === form.item_group)?.label || form.item_group || 'Select Item Group';

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-gray-900">Item</h1>
            <div className="flex items-center space-x-1 text-sm text-gray-600">
              <span>List View</span>
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); fetchItemGroups(); }}
            className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>

        {/* List View */}
        <main className="p-6">
          {loading ? (
            <div className="text-center py-10">Loading items...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </th>
                      {[
                        { label: 'ID', state: filterId, setState: setFilterId },
                        { label: 'Item Name', state: filterName, setState: setFilterName },
                        { label: 'Item Group', state: filterGroup, setState: setFilterGroup },
                        { label: 'Status', state: filterStatus, setState: setFilterStatus, options: ['Enabled', 'Disabled'] },
                        { label: 'Has Variants', state: filterHasVariants, setState: setFilterHasVariants, options: ['Yes', 'No'] },
                        { label: 'Last Updated On', state: filterLastUpdated, setState: setFilterLastUpdated },
                      ].map((col, i) => (
                        <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="space-y-1">
                            <span>{col.label}</span>
                            {col.options ? (
                              <select
                                value={col.state}
                                onChange={(e) => col.setState(e.target.value)}
                                className="block w-full text-xs border border-gray-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">All</option>
                                {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <div className="relative">
                                <Search className="absolute left-2 top-2 w-3 h-3 text-gray-400" />
                                <input
                                  type="text"
                                  value={col.state}
                                  onChange={(e) => col.setState(e.target.value)}
                                  placeholder="Filter..."
                                  className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedItems.length === 0 ? (
                      <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No items found</td></tr>
                    ) : (
                      paginatedItems.map(item => (
                        <tr key={item.name} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap"><input type="checkbox" className="rounded border-gray-300" /></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.item_code}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.item_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.item_group}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${!item.disabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {!item.disabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.has_variants ? 'Yes' : 'No'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                            {item.modified ? new Date(item.modified).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} results
                </div>
                <div className="flex items-center space-x-2">
                  {[20, 100, 500, 2500].map(size => (
                    <button
                      key={size}
                      onClick={() => { setPageSize(size); setCurrentPage(1); }}
                      className={`px-3 py-1 text-sm rounded-md ${pageSize === size ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ERPNext Full Form */}
        {showForm && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button onClick={() => setShowForm(false)} className="text-gray-600 hover:text-gray-900">
                  <Menu className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-semibold text-gray-900">New Item</h1>
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
                  onClick={handleCreate}
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
                  {/* Left */}
                  <div className="space-y-5">
                    {/* Item Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.item_code}
                        onChange={e => setForm({ ...form, item_code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                        placeholder="ITM-001"
                      />
                    </div>

                    {/* Item Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                      <input
                        type="text"
                        value={form.item_name}
                        onChange={e => setForm({ ...form, item_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Item Group Dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Group <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <button
                          onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                          className="w-full px-3 py-2 text-left border border-gray-300 rounded-md flex items-center justify-between focus:ring-1 focus:ring-blue-500"
                        >
                          <span className="truncate">{selectedGroupLabel}</span>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>

                        {showGroupDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                            <div className="p-2 border-b">
                              <input
                                type="text"
                                value={groupSearch}
                                onChange={e => setGroupSearch(e.target.value)}
                                placeholder="Search groups..."
                                className="w-full px-2 py-1 text-sm border rounded"
                                autoFocus
                              />
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              {groupLoading ? (
                                <div className="p-3 text-center text-sm text-gray-500">Loading...</div>
                              ) : itemGroups.length === 0 ? (
                                <div className="p-3 text-center text-sm text-gray-500">No groups found</div>
                              ) : (
                                itemGroups.map(g => (
                                  <button
                                    key={g.value}
                                    onClick={() => {
                                      setForm({ ...form, item_group: g.value });
                                      setShowGroupDropdown(false);
                                      setGroupSearch('');
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                                  >
                                    <span className="truncate">{g.label}</span>
                                    {form.item_group === g.value && <ChevronRight className="w-4 h-4" />}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tax Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tax Code</label>
                      <input
                        type="text"
                        value={form.tax_code}
                        onChange={e => setForm({ ...form, tax_code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Zero Rated / Exempt */}
                    <div className="flex items-center space-x-6">
                      <label className="flex items-center">
                        <input type="checkbox" checked={form.is_zero_rated} onChange={e => setForm({ ...form, is_zero_rated: e.target.checked })} className="mr-2" />
                        <span className="text-sm">Is Zero Rated</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" checked={form.is_exempt} onChange={e => setForm({ ...form, is_exempt: e.target.checked })} className="mr-2" />
                        <span className="text-sm">Is Exempt</span>
                      </label>
                    </div>

                    {/* UOM */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Unit of Measure <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.default_uom}
                        onChange={e => setForm({ ...form, default_uom: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                        placeholder="Nos"
                      />
                    </div>
                  </div>

                  {/* Right */}
                  <div className="space-y-5">
                    <div className="flex items-center space-x-6">
                      <label className="flex items-center">
                        <input type="checkbox" checked={form.disabled} onChange={e => setForm({ ...form, disabled: e.target.checked })} className="mr-2" />
                        <span className="text-sm">Disabled</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" checked={form.allow_alternative_item} onChange={e => setForm({ ...form, allow_alternative_item: e.target.checked })} className="mr-2" />
                        <span className="text-sm">Allow Alternative Item</span>
                      </label>
                    </div>

                    <div className="flex items-center space-x-6">
                      <label className="flex items-center">
                        <input type="checkbox" checked={form.maintain_stock} onChange={e => setForm({ ...form, maintain_stock: e.target.checked })} className="mr-2" />
                        <span className="text-sm">Maintain Stock</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" checked={form.has_variants} onChange={e => setForm({ ...form, has_variants: e.target.checked })} className="mr-2" />
                        <span className="text-sm">Has Variants</span>
                      </label>
                    </div>

                    {form.has_variants && (
                      <p className="text-xs text-gray-500">
                        If this item has variants, then it cannot be selected in sales orders etc.
                      </p>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock</label>
                      <input
                        type="number"
                        value={form.opening_stock}
                        onChange={e => setForm({ ...form, opening_stock: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Rate</label>
                      <input
                        type="number"
                        value={form.valuation_rate}
                        onChange={e => setForm({ ...form, valuation_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Standard Selling Rate</label>
                      <input
                        type="number"
                        value={form.standard_selling_rate}
                        onChange={e => setForm({ ...form, standard_selling_rate: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center">
                      <label className="flex items-center">
                        <input type="checkbox" checked={form.is_fixed_asset} onChange={e => setForm({ ...form, is_fixed_asset: e.target.checked })} className="mr-2" />
                        <span className="text-sm">Is Fixed Asset</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                  <div className="mt-1 flex items-center space-x-4">
                    {form.imagePreview ? (
                      <div className="relative">
                        <img src={form.imagePreview} alt="Preview" className="h-32 w-32 object-cover rounded-md border" />
                        <button
                          onClick={removeImage}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-md w-32 h-32 flex items-center justify-center">
                        <Upload className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Choose File
                      </button>
                      <p className="mt-1 text-xs text-gray-500">PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default ItemList;