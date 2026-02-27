// src/pages/ItemList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, X, Save, Upload, Package, Camera, ChevronLeft,
  Users, AlertCircle,
  ChevronDown
} from 'lucide-react';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/library';
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

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    item_code: '', item_name: '', item_group: '', disabled: false,
    allow_alternative_item: false, maintain_stock: true, has_variants: false,
    opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0,
    is_fixed_asset: false, is_zero_rated: false, is_exempt: false,
    default_uom: 'Nos', tax_code: '', description: '', image: null, imagePreview: null
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // Item Groups
  const [itemGroups, setItemGroups] = useState([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  // Barcodes
  const [barcodes, setBarcodes] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const barcodeInputRef = useRef(null);

  /* ==================== HARDWARE SCANNER ==================== */
  useEffect(() => {
    if (!showForm || !isScanning) return;

    let input = '';
    let timeout;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && input.trim().length > 3) {
        e.preventDefault();
        addBarcode(input.trim());
        input = '';
      } else if (e.key.length === 1) {
        input += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => input = '', 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showForm, isScanning]);

  /* ==================== ADD BARCODE ==================== */
  const addBarcode = async (code) => {
    if (!code) return;
    code = code.trim();
    if (!code) return;

    if (barcodes.some(b => b.barcode === code)) {
      alert('This barcode is already added!');
      return;
    }

    try {
      const res = await axios.get('http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists', {
        params: { barcode: code },
        withCredentials: true
      });
      if (res.data.message.exists) {
        alert(`Barcode ${code} is already used by item: ${res.data.message.item}`);
        return;
      }
    } catch (err) {
      console.error(err);
    }

    setBarcodes(prev => [...prev, { barcode: code, uom: form.default_uom || 'Nos' }]);
    setBarcodeInput('');
    setIsScanning(false);
  };

  /* ==================== CAMERA SCANNER ==================== */
  const CameraScanner = () => {
    const videoRef = useRef(null);
    const reader = useRef(new BrowserMultiFormatReader());

    useEffect(() => {
      reader.current.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) {
          addBarcode(result.getText());
          setShowCameraScanner(false);
        }
      });
      return () => reader.current.reset();
    }, []);

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="bg-white p-5 flex justify-between items-center shadow-lg">
          <h3 className="text-xl font-semibold">Scan Barcode with Camera</h3>
          <button onClick={() => setShowCameraScanner(false)} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-7 h-7" />
          </button>
        </div>
        <video ref={videoRef} className="flex-1 w-full object-cover" />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
          <div className="border-4 border-red-500 rounded-xl w-80 h-48 opacity-80"></div>
        </div>
        <div className="absolute bottom-10 left-0 right-0 text-center">
          <p className="text-white text-xl font-medium bg-black bg-opacity-60 py-3 px-8 rounded-full inline-block">
            Align barcode inside the red frame
          </p>
        </div>
      </div>
    );
  };

  /* ==================== FETCH DATA ==================== */
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', { withCredentials: true });
      setItems(res.data.message || []);
    } catch (err) {
      alert('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showForm) {
      const t = setTimeout(() => fetchItemGroups(groupSearch), 300);
      return () => clearTimeout(t);
    }
  }, [groupSearch, showForm]);

  const fetchItemGroups = async (search = '') => {
    try {
      const res = await axios.get('http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups', {
        params: { search },
        withCredentials: true
      });
      if (res.data.message.success) setItemGroups(res.data.message.data);
    } catch (err) { console.error(err); }
  };

  /* ==================== FILTERING ==================== */
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const id = !filterId || item.item_code.toLowerCase().includes(filterId.toLowerCase());
      const name = !filterName || item.item_name.toLowerCase().includes(filterName.toLowerCase());
      const group = !filterGroup || item.item_group.toLowerCase().includes(filterGroup.toLowerCase());
      const status = !filterStatus || (filterStatus === 'Enabled' ? !item.disabled : item.disabled);
      const variants = !filterHasVariants || (filterHasVariants === 'Yes' ? item.has_variants : !item.has_variants);
      return id && name && group && status && variants;
    });
  }, [items, filterId, filterName, filterGroup, filterStatus, filterHasVariants]);

  const total = filteredItems.length;
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ==================== IMAGE HANDLING ==================== */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, image: reader.result, imagePreview: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setForm({ ...form, image: null, imagePreview: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ==================== SAVE ITEM ==================== */
  const handleCreate = async () => {
    if (!form.item_code.trim() || !form.item_name.trim() || !form.item_group || !form.default_uom.trim()) {
      alert('Please fill all required fields: Item Code, Item Name, Item Group, Default UOM');
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
        image: form.image || '',
        barcodes: barcodes.length > 0 ? barcodes : undefined
      };

      const res = await axios.post('http://75.119.130.59/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item', payload, { withCredentials: true });

      if (res.data.message.success) {
        alert('Item created successfully!');
        setShowForm(false);
        setBarcodes([]);
        setForm({
          item_code: '', item_name: '', item_group: '', disabled: false,
          allow_alternative_item: false, maintain_stock: true, has_variants: false,
          opening_stock: 0, valuation_rate: 0, standard_selling_rate: 0,
          is_fixed_asset: false, is_zero_rated: false, is_exempt: false,
          default_uom: 'Nos', tax_code: '', description: '', image: null, imagePreview: null
        });
        fetchItems();
        setCurrentPage(1);
      }
    } catch (err) {
      alert(err.response?.data?.message?.message || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseForm = () => {
    const hasChanges = form.item_code || form.item_name || form.item_group || barcodes.length > 0 || form.image;
    if (hasChanges && !window.confirm('Discard unsaved changes?')) return;
    setShowForm(false);
    setBarcodes([]);
    setForm(prev => ({ ...prev, item_code: '', item_name: '', item_group: '', image: null, imagePreview: null }));
  };

  const selectedGroupLabel = itemGroups.find(g => g.value === form.item_group)?.label || 'Select Item Group';

  return (
    <>
      <NavBar />
      <div className="min-h-screen bg-gray-50">

        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Package className="w-8 h-8 text-gray-600" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Items</h1>
                <p className="text-sm text-gray-500 mt-1">{total} items</p>
              </div>
            </div>
            <button
              onClick={() => { setShowForm(true); fetchItemGroups(); }}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Add Item
            </button>
          </div>

          {/* Global Search */}
          <div className="px-6 pb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search items by code or name..."
                value={filterName || filterId}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterId(val);
                  setFilterName(val);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Main Table */}
        <div className="p-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600">Loading items...</p>
              </div>
            ) : paginatedItems.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {total === 0 ? 'No items yet' : 'No items match your filters'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {total === 0 ? 'Start by adding your first item.' : 'Try adjusting your search or filters.'}
                </p>
                {total === 0 && (
                  <button
                    onClick={() => { setShowForm(true); fetchItemGroups(); }}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5" />
                    Add First Item
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
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item Group</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Variants</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedItems.map(item => (
                        <tr key={item.name} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_code}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.item_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.item_group}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                              !item.disabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {!item.disabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{item.has_variants ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-700">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, total)} of {total} items
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">Rows per page:</span>
                    <div className="flex gap-2">
                      {[20, 50, 100].map(size => (
                        <button
                          key={size}
                          onClick={() => { setPageSize(size); setCurrentPage(1); }}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                            pageSize === size ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 hover:bg-gray-100'
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

        {/* ==================== ADD ITEM MODAL ==================== */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col my-8">
              {/* Modal Header */}
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
                    <h2 className="text-2xl font-semibold text-gray-900">New Item</h2>
                    <p className="text-sm text-gray-500 mt-1">Create a new inventory item</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="space-y-8">

                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.item_code}
                        onChange={e => setForm({ ...form, item_code: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ITM-001"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.item_name}
                        onChange={e => setForm({ ...form, item_name: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Product Name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item Group <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex justify-between items-center hover:bg-gray-50"
                        >
                          <span className={form.item_group ? 'text-gray-900' : 'text-gray-500'}>
                            {selectedGroupLabel}
                          </span>
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        </button>
                        {showGroupDropdown && (
                          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            <input
                              type="text"
                              value={groupSearch}
                              onChange={e => setGroupSearch(e.target.value)}
                              placeholder="Search groups..."
                              className="w-full px-4 py-3 border-b border-gray-200 focus:outline-none"
                              autoFocus
                            />
                            {itemGroups.map(g => (
                              <button
                                key={g.value}
                                onClick={() => {
                                  setForm({ ...form, item_group: g.value });
                                  setShowGroupDropdown(false);
                                  setGroupSearch('');
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-blue-50 flex justify-between items-center"
                              >
                                <span>{g.label}</span>
                                {form.item_group === g.value && <ChevronRight className="w-5 h-5 text-blue-600" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Default UOM <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.default_uom}
                        onChange={e => setForm({ ...form, default_uom: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nos"
                      />
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={form.disabled} onChange={e => setForm({ ...form, disabled: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                      <span className="text-sm font-medium">Disabled</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={form.maintain_stock} onChange={e => setForm({ ...form, maintain_stock: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                      <span className="text-sm font-medium">Maintain Stock</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={form.has_variants} onChange={e => setForm({ ...form, has_variants: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                      <span className="text-sm font-medium">Has Variants</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input type="checkbox" checked={form.is_fixed_asset} onChange={e => setForm({ ...form, is_fixed_asset: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                      <span className="text-sm font-medium">Fixed Asset</span>
                    </label>
                  </div>

                  {/* Rates */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Opening Stock</label>
                      <input type="number" value={form.opening_stock} onChange={e => setForm({ ...form, opening_stock: Number(e.target.value) })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Valuation Rate</label>
                      <input type="number" value={form.valuation_rate} onChange={e => setForm({ ...form, valuation_rate: Number(e.target.value) })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Standard Selling Rate</label>
                      <input type="number" value={form.standard_selling_rate} onChange={e => setForm({ ...form, standard_selling_rate: Number(e.target.value) })} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500" />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional item description..."
                    />
                  </div>

                  {/* Barcodes Section */}
                  <div className="border-t pt-8">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900">Barcodes</h3>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setIsScanning(true); barcodeInputRef.current?.focus(); }}
                          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          <Package className="w-5 h-5" />
                          Hardware Scanner
                        </button>
                        <button
                          onClick={() => setShowCameraScanner(true)}
                          className="flex items-center gap-2 px-5 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                          <Camera className="w-5 h-5" />
                          Camera Scan
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-4 mb-6">
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        value={barcodeInput}
                        onChange={e => setBarcodeInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && barcodeInput && addBarcode(barcodeInput)}
                        placeholder="Type or scan barcode..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500"
                      />
                      <button
                        onClick={() => barcodeInput && addBarcode(barcodeInput)}
                        className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                      >
                        Add
                      </button>
                    </div>

                    {barcodes.length > 0 && (
                      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                        {barcodes.map((b, i) => (
                          <div key={i} className="p-4 flex justify-between items-center hover:bg-gray-50">
                            <div>
                              <span className="font-mono text-lg font-semibold">{b.barcode}</span>
                              <span className="text-gray-500 ml-4">({b.uom})</span>
                            </div>
                            <button
                              onClick={() => setBarcodes(prev => prev.filter((_, idx) => idx !== i))}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">Item Image</label>
                    <div className="flex gap-8 items-start">
                      <div className="relative">
                        {form.imagePreview ? (
                          <>
                            <img src={form.imagePreview} alt="Preview" className="w-64 h-64 object-cover rounded-xl border border-gray-200 shadow-md" />
                            <button
                              onClick={removeImage}
                              className="absolute top-3 right-3 p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <div className="w-64 h-64 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400">
                            <Upload className="w-16 h-16 mb-4" />
                            <p className="text-center px-4">No image uploaded</p>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-6 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors font-medium"
                        >
                          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                          Choose Image
                        </button>
                        <p className="text-sm text-gray-500 mt-3">Supported: PNG, JPG • Max 5MB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-8 py-6 border-t border-gray-200 flex justify-end gap-4 bg-gray-50">
                <button
                  onClick={handleCloseForm}
                  className="px-6 py-3 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.item_code.trim() || !form.item_name.trim() || !form.item_group}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {saving && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>}
                  {saving ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Camera Scanner Fullscreen */}
        {showCameraScanner && <CameraScanner />}
      </div>
    </>
  );
}

export default ItemList;