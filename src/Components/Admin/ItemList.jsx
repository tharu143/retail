// src/pages/ItemList.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, ChevronDown, Search, X, Save, Upload, Menu,
  Copy, Trash2, Package, Camera, AlertCircle, ChevronRight
} from 'lucide-react';
import axios from 'axios';
import { BrowserMultiFormatReader } from '@zxing/library';
import NavBar from '../Nav/NavBar';

function ItemList() {
const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // FILTERS (ഇത് മുൻപ് മിസ്സായിരുന്നു!)
  const [filterId, setFilterId] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHasVariants, setFilterHasVariants] = useState('');

  // Form
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

  // ==================== HARDWARE SCANNER ====================
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

  // ==================== ADD BARCODE ====================
  const addBarcode = async (code) => {
    if (!code) return;
    code = code.trim();
    if (!code) return;

    if (barcodes.some(b => b.barcode === code)) {
      alert('This barcode already added!');
      return;
    }

    try {
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.check_barcode_exists', {
        params: { barcode: code },
        withCredentials: true
      });
      if (res.data.message.exists) {
        alert(`Barcode ${code} already used by item: ${res.data.message.item}`);
        return;
      }
    } catch (err) {
      console.error(err);
    }

    setBarcodes(prev => [...prev, { barcode: code, uom: form.default_uom || 'Nos' }]);
    setBarcodeInput('');
    setIsScanning(false);
    alert(`Barcode added: ${code}`);
  };

  // ==================== CAMERA SCANNER ====================
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
        <div className="bg-white p-4 flex justify-between items-center">
          <h3 className="text-lg font-bold">Scan with Camera</h3>
          <button onClick={() => setShowCameraScanner(false)} className="text-red-600">
            <X className="w-8 h-8" />
          </button>
        </div>
        <video ref={videoRef} className="flex-1 w-full" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-4 border-red-500 rounded-lg w-96 h-56 opacity-70"></div>
        </div>
        <div className="absolute bottom-12 left-0 right-0 text-center">
          <p className="text-white text-2xl font-bold bg-black bg-opacity-70 py-4 px-6 rounded-lg">
            Align barcode inside red box
          </p>
        </div>
      </div>
    );
  };

  // ==================== FETCH DATA ====================
  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_details', { withCredentials: true });
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
      const res = await axios.get('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups', {
        params: { search },
        withCredentials: true
      });
      if (res.data.message.success) setItemGroups(res.data.message.data);
    } catch (err) { console.error(err); }
  };

  // ==================== FILTER LOGIC (NOW WORKING!) ====================
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

  // ==================== IMAGE & SAVE ====================
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

  const handleCreate = async () => {
    if (!form.item_code || !form.item_name || !form.item_group || !form.default_uom) {
      alert('Required: Item Code, Name, Group, UOM');
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

      const res = await axios.post('/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_item', payload, { withCredentials: true });

      if (res.data.message.success) {
        alert('Item created!');
        setShowForm(false);
        setBarcodes([]);
        setForm(prev => ({ ...prev, item_code: '', item_name: '', item_group: '', image: null, imagePreview: null }));
        fetchItems();
      }
    } catch (err) {
      alert(err.response?.data?.message?.message || 'Failed');
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
          <button onClick={() => { setShowForm(true); fetchItemGroups(); }} className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800">
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>

        {/* LIST VIEW WITH FULL FILTERS (NOW WORKING!) */}
        <main className="p-6">
          {loading ? (
            <div className="text-center py-20 text-gray-500">Loading items...</div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input type="checkbox" className="rounded border-gray-300" />
                      </th>
                      {/* FILTER ROWS */}
                      {[
                        { label: 'ID', state: filterId, setState: setFilterId },
                        { label: 'Item Name', state: filterName, setState: setFilterName },
                        { label: 'Item Group', state: filterGroup, setState: setFilterGroup },
                        { label: 'Status', state: filterStatus, setState: setFilterStatus, options: ['Enabled', 'Disabled'] },
                        { label: 'Has Variants', state: filterHasVariants, setState: setFilterHasVariants, options: ['Yes', 'No'] },
                      ].map((col, i) => (
                        <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="space-y-2">
                            <div>{col.label}</div>
                            {col.options ? (
                              <select value={col.state} onChange={e => col.setState(e.target.value)} className="w-full text-xs border rounded px-2 py-1">
                                <option value="">All</option>
                                {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <div className="relative">
                                <Search className="absolute left-2 top-2 w-3 h-3 text-gray-400" />
                                <input
                                  type="text"
                                  value={col.state}
                                  onChange={e => col.setState(e.target.value)}
                                  placeholder="Filter..."
                                  className="w-full pl-7 pr-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
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
                      <tr><td colSpan="6" className="text-center py-12 text-gray-500">No items found</td></tr>
                    ) : (
                      paginatedItems.map(item => (
                        <tr key={item.name} className="hover:bg-gray-50">
                          <td className="px-6 py-4"><input type="checkbox" className="rounded border-gray-300" /></td>
                          <td className="px-6 py-4 text-sm text-gray-900">{item.item_code}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{item.item_group}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${!item.disabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {!item.disabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{item.has_variants ? 'Yes' : 'No'}</td>
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
                <div className="flex gap-2">
                  {[20, 100, 500].map(size => (
                    <button key={size} onClick={() => { setPageSize(size); setCurrentPage(1); }}
                      className={`px-3 py-1 text-sm rounded ${pageSize === size ? 'bg-blue-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ==================== FULL FORM ==================== */}
        {showForm && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col">
            <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowForm(false)}><Menu className="w-6 h-6" /></button>
                <h1 className="text-2xl font-bold">New Item</h1>
                <span className="text-orange-600">Not Saved</span>
              </div>
              <button onClick={handleCreate} disabled={saving} className="bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700">
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-5xl mx-auto space-y-8">

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left */}
                  <div className="space-y-6">
                    <div>
                      <label className="block font-medium mb-1">Item Code <span className="text-red-500">*</span></label>
                      <input type="text" value={form.item_code} onChange={e => setForm({...form, item_code: e.target.value})} className="w-full px-4 py-3 border rounded-lg" placeholder="ITM-001" />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Item Name <span className="text-red-500">*</span></label>
                      <input type="text" value={form.item_name} onChange={e => setForm({...form, item_name: e.target.value})} className="w-full px-4 py-3 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Item Group <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <button onClick={() => setShowGroupDropdown(!showGroupDropdown)} className="w-full px-4 py-3 border rounded-lg text-left flex justify-between items-center">
                          <span>{selectedGroupLabel}</span>
                          <ChevronDown className="w-5 h-5" />
                        </button>
                        {showGroupDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                            <input type="text" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} placeholder="Search..." className="w-full px-4 py-2 border-b" autoFocus />
                            {itemGroups.map(g => (
                              <button key={g.value} onClick={() => { setForm({...form, item_group: g.value}); setShowGroupDropdown(false); setGroupSearch(''); }}
                                className="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between">
                                <span>{g.label}</span>
                                {form.item_group === g.value && <ChevronRight />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Default UOM <span className="text-red-500">*</span></label>
                      <input type="text" value={form.default_uom} onChange={e => setForm({...form, default_uom: e.target.value})} className="w-full px-4 py-3 border rounded-lg" placeholder="Nos" />
                    </div>
                  </div>

                  {/* Right */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={form.disabled} onChange={e => setForm({...form, disabled: e.target.checked})} /> Disabled</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={form.maintain_stock} onChange={e => setForm({...form, maintain_stock: e.target.checked})} /> Maintain Stock</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={form.has_variants} onChange={e => setForm({...form, has_variants: e.target.checked})} /> Has Variants</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_fixed_asset} onChange={e => setForm({...form, is_fixed_asset: e.target.checked})} /> Fixed Asset</label>
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Opening Stock</label>
                      <input type="number" value={form.opening_stock} onChange={e => setForm({...form, opening_stock: +e.target.value})} className="w-full px-4 py-3 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Valuation Rate</label>
                      <input type="number" value={form.valuation_rate} onChange={e => setForm({...form, valuation_rate: +e.target.value})} className="w-full px-4 py-3 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Standard Selling Rate</label>
                      <input type="number" value={form.standard_selling_rate} onChange={e => setForm({...form, standard_selling_rate: +e.target.value})} className="w-full px-4 py-3 border rounded-lg" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-medium mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={4} className="w-full px-4 py-3 border rounded-lg" />
                </div>

                {/* Barcodes */}
                <div className="border-t pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Barcodes</h3>
                    <div className="flex gap-3">
                      <button onClick={() => { setIsScanning(true); setBarcodeInput(''); barcodeInputRef.current?.focus(); }} className="bg-blue-600 text-white px-5 py-3 rounded-lg flex items-center gap-2">
                        <Package /> Hardware Scan
                      </button>
                      <button onClick={() => setShowCameraScanner(true)} className="bg-purple-600 text-white px-5 py-3 rounded-lg flex items-center gap-2">
                        <Camera /> Camera Scan
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 mb-4">
                    <input ref={barcodeInputRef} type="text" value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && barcodeInput && addBarcode(barcodeInput)}
                      placeholder="Scan or type barcode..." className="flex-1 px-4 py-3 border rounded-lg" />
                    <button onClick={() => barcodeInput && addBarcode(barcodeInput)} className="bg-green-600 text-white px-8 py-3 rounded-lg">Add</button>
                  </div>
                  {barcodes.length > 0 && (
                    <div className="border rounded-lg divide-y">
                      {barcodes.map((b, i) => (
                        <div key={i} className="p-4 flex justify-between items-center">
                          <div>
                            <span className="font-mono text-xl">{b.barcode}</span>
                            <span className="text-gray-500 ml-4">({b.uom})</span>
                          </div>
                          <button onClick={() => setBarcodes(barcodes.filter((_, idx) => idx !== i))} className="text-red-600">
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Image */}
                <div>
                  <label className="block font-medium mb-3">Image</label>
                  <div className="flex gap-6 items-start">
                    {form.imagePreview ? (
                      <div className="relative">
                        <img src={form.imagePreview} alt="Preview" className="w-48 h-48 object-cover rounded-lg border" />
                        <button onClick={removeImage} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-48 h-48 border-2 border-dashed rounded-lg flex items-center justify-center">
                        <Upload className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 border rounded-lg hover:bg-gray-50">
                        Choose Image
                      </button>
                      <p className="text-sm text-gray-500 mt-2">PNG, JPG up to 5MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Camera Scanner Modal */}
        {showCameraScanner && <CameraScanner />}
      </div>
    </>
  );
}

export default ItemList;