import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  Boxes, Plus, Search, Filter, Trash2, Edit2, ChevronRight,
  Eye, CheckCircle2, AlertTriangle, Building2, Package, RefreshCw,
  X, Save, Layers, ArrowLeft, Loader2, Info, ShoppingBag
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { frappeCall } from '../../utils/frappe';

const ProductBundleList = () => {
  const navigate = useNavigate();
  const { warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemGroup, setSelectedItemGroup] = useState('All');
  const [itemGroups, setItemGroups] = useState(['All']);
  const [warehousesList, setWarehousesList] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(warehouse || '');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State for Create / Edit
  const [formParentItem, setFormParentItem] = useState('');
  const [formSellingRate, setFormSellingRate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formItems, setFormItems] = useState([]);
  const [formBranchAvailability, setFormBranchAvailability] = useState([]);

  // Item Search State for Bundle Items
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState([]);
  const [searchingItems, setSearchingItems] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(null);

  // Parent Item Search State
  const [parentSearchResults, setParentSearchResults] = useState([]);
  const [showParentDropdown, setShowParentDropdown] = useState(false);

  // Theme Sync
  const legacySubTheme = localStorage.getItem('legacySubTheme') || 'green';
  const isGreen = legacySubTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';

  // Fetch Product Bundles
  const fetchBundles = async () => {
    try {
      setLoading(true);
      const res = await frappeCall({
        method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_product_bundles',
        args: {
          warehouse: selectedBranch,
          item_group: selectedItemGroup,
          search_term: searchTerm
        },
        type: 'POST'
      });
      if (res?.status === 'success') {
        setBundles(res.data || []);
      } else {
        setBundles([]);
      }
    } catch (err) {
      console.error('Error fetching product bundles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Item Groups & Warehouses for Dropdowns
  const fetchMetadata = async () => {
    try {
      const [groupsRes, whRes] = await Promise.all([
        frappeCall({
          method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_bundle_item_groups',
          type: 'POST'
        }),
        frappeCall({
          method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_warehouses',
          type: 'POST'
        })
      ]);
      if (groupsRes?.status === 'success') {
        setItemGroups(['All', ...(groupsRes.data || [])]);
      }
      if (whRes?.status === 'success') {
        setWarehousesList(whRes.data || []);
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchBundles();
  }, [selectedBranch, selectedItemGroup, searchTerm]);

  // Search Parent Item for autocomplete
  const handleParentItemSearch = async (query) => {
    if (!query || query.length < 1) {
      setParentSearchResults([]);
      setShowParentDropdown(false);
      return;
    }
    try {
      const res = await frappeCall({
        method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_items_for_po',
        args: { query, warehouse: selectedBranch },
        type: 'POST'
      });
      const items = Array.isArray(res) ? res : (res?.data || []);
      setParentSearchResults(items);
      setShowParentDropdown(items.length > 0);
    } catch (err) {
      console.error('Error searching parent items:', err);
    }
  };

  // Search items for dropdown
  const handleItemSearch = async (query, index) => {
    setActiveItemIndex(index);
    if (!query || query.length < 1) {
      setItemSearchResults([]);
      return;
    }
    try {
      setSearchingItems(true);
      const res = await frappeCall({
        method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_items_for_po',
        args: { query, warehouse: selectedBranch },
        type: 'POST'
      });
      // get_items_for_po directly returns an array or object
      if (Array.isArray(res)) {
        setItemSearchResults(res);
      } else if (res?.status === 'success') {
        setItemSearchResults(res.data || []);
      } else {
        setItemSearchResults([]);
      }
    } catch (err) {
      console.error('Error searching items:', err);
    } finally {
      setSearchingItems(false);
    }
  };

  const handleSelectChildItem = (item, index) => {
    const newItems = [...formItems];
    newItems[index] = {
      ...newItems[index],
      item_code: item.item_code,
      item_name: item.item_name,
      uom: item.stock_uom || 'Nos',
      rate: item.standard_rate || 0,
      actual_qty: item.actual_qty || 0
    };
    setFormItems(newItems);
    setItemSearchResults([]);
    setActiveItemIndex(null);
  };

  const handleAddBundleRow = () => {
    setFormItems([
      ...formItems,
      { item_code: '', item_name: '', qty: 1, uom: 'Nos', rate: 0, description: '' }
    ]);
  };

  const handleRemoveBundleRow = (index) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setFormParentItem('');
    setFormSellingRate('');
    setFormDescription('');
    setFormItems([{ item_code: '', item_name: '', qty: 1, uom: 'Nos', rate: 0, description: '' }]);
    setFormBranchAvailability(selectedBranch ? [selectedBranch] : []);
    setShowModal(true);
  };

  const handleOpenEditModal = (bundle) => {
    setIsEditing(true);
    setSelectedBundle(bundle);
    setFormParentItem(bundle.new_item_code);
    setFormSellingRate(bundle.selling_price || bundle.standard_rate || '');
    setFormDescription(bundle.description || '');
    setFormItems(
      (bundle.items || []).map(i => ({
        item_code: i.item_code,
        item_name: i.item_name || i.item_code,
        qty: i.qty || 1,
        uom: i.uom || 'Nos',
        rate: i.rate || 0,
        description: i.description || ''
      }))
    );
    setFormBranchAvailability(bundle.branch_availability || []);
    setShowModal(true);
  };

  const handleSaveBundle = async () => {
    if (!formParentItem) {
      Swal.fire('Required', 'Please enter or select a parent Item Code', 'warning');
      return;
    }
    const validItems = formItems.filter(i => i.item_code && i.qty > 0);
    if (validItems.length === 0) {
      Swal.fire('Required', 'Please add at least one valid child item with Qty > 0', 'warning');
      return;
    }

    try {
      setSaving(true);
      let res;
      if (isEditing) {
        res = await frappeCall({
          method: 'custom_retailpos.custom_retailpos.retail_api.retail.update_product_bundle',
          args: {
            name: selectedBundle.name,
            items: JSON.stringify(validItems),
            description: formDescription,
            branch_availability: JSON.stringify(formBranchAvailability),
            selling_rate: formSellingRate
          },
          type: 'POST'
        });
      } else {
        res = await frappeCall({
          method: 'custom_retailpos.custom_retailpos.retail_api.retail.create_product_bundle',
          args: {
            new_item_code: formParentItem,
            items: JSON.stringify(validItems),
            description: formDescription,
            branch_availability: JSON.stringify(formBranchAvailability),
            selling_rate: formSellingRate
          },
          type: 'POST'
        });
      }

      if (res?.status === 'success') {
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: res.message || 'Bundle saved successfully',
          timer: 1500,
          showConfirmButton: false
        });
        setShowModal(false);
        fetchBundles();
      } else {
        Swal.fire('Error', res?.message || 'Failed to save product bundle', 'error');
      }
    } catch (err) {
      console.error('Error saving bundle:', err);
      Swal.fire('Error', typeof err === 'string' ? err : 'Failed to save bundle', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBundle = async (bundle) => {
    const confirm = await Swal.fire({
      title: 'Delete Product Bundle?',
      text: `Are you sure you want to delete bundle '${bundle.new_item_code}'?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Delete'
    });

    if (confirm.isConfirmed) {
      try {
        const res = await frappeCall({
          method: 'custom_retailpos.custom_retailpos.retail_api.retail.delete_product_bundle',
          args: { name: bundle.name },
          type: 'POST'
        });
        if (res?.status === 'success') {
          Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
          fetchBundles();
        } else {
          Swal.fire('Error', res?.message || 'Could not delete bundle', 'error');
        }
      } catch (err) {
        Swal.fire('Error', 'Failed to delete bundle', 'error');
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl" style={{ backgroundColor: themeLight, color: themeColor }}>
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Product Bundles</h1>
            <p className="text-xs text-gray-500">Manage item bundles, prices & branch availability</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBundles}
            className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition border border-gray-200"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 text-white font-medium rounded-xl shadow-sm transition hover:opacity-90 text-sm"
            style={{ backgroundColor: themeColor }}
          >
            <Plus className="w-4 h-4" />
            <span>Create Product Bundle</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search Bundle Code / Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Item Group Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedItemGroup}
            onChange={(e) => setSelectedItemGroup(e.target.value)}
            className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
          >
            {itemGroups.map((grp) => (
              <option key={grp} value={grp}>{grp === 'All' ? 'All Item Groups' : grp}</option>
            ))}
          </select>
        </div>

        {/* Branch / Warehouse Filter */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
          >
            <option value="">All Warehouses / Branches</option>
            {warehousesList.map((wh) => (
              <option key={wh.name || wh} value={wh.name || wh}>{wh.warehouse_name || wh.name || wh}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Bundles Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
          <p className="text-sm text-gray-500">Loading Product Bundles...</p>
        </div>
      ) : bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 text-center">
          <Package className="w-12 h-12 text-gray-300 mb-3" />
          <h3 className="text-base font-semibold text-gray-700">No Product Bundles Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mt-1">
            No bundle matched your search criteria or branch filters. Click "Create Product Bundle" to define one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bundles.map((bundle) => (
            <div
              key={bundle.name}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
            >
              {/* Top Banner */}
              <div className="p-5 border-b border-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="inline-block px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full">
                      {bundle.item_group || 'Bundle'}
                    </span>
                    <h3 className="font-bold text-gray-800 text-base line-clamp-1">{bundle.item_name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{bundle.new_item_code}</p>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center justify-end text-emerald-600 font-bold text-lg">
                      <DirhamIcon className="w-4 h-4 mr-1" />
                      <span>{bundle.selling_price?.toFixed(2)}</span>
                    </div>
                    {bundle.calculated_price !== bundle.selling_price && (
                      <span className="text-[10px] text-gray-400 line-through">
                        AED {bundle.calculated_price?.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {bundle.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{bundle.description}</p>
                )}
              </div>

              {/* Items Breakdown */}
              <div className="p-4 bg-gray-50/50 space-y-2 flex-grow">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 pb-1">
                  <span>Bundle Items ({bundle.items?.length || 0})</span>
                  <span>Branch Stock</span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {(bundle.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 bg-white rounded-lg border border-gray-100">
                      <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                        <span className="font-semibold text-gray-700 min-w-[20px]">{item.qty}x</span>
                        <span className="text-gray-600 truncate">{item.item_name || item.item_code}</span>
                      </div>
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                        item.actual_qty > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {item.actual_qty || 0} {item.uom}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-gray-500">
                  <span className="font-medium text-gray-700">Available:</span>
                  <span className={`font-bold ${bundle.available_bundle_qty > 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {bundle.available_bundle_qty} sets
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedBundle(bundle);
                      setShowDetailModal(true);
                    }}
                    className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(bundle)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit Bundle"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteBundle(bundle)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete Bundle"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Bundle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: themeLight, color: themeColor }}>
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {isEditing ? `Edit Product Bundle: ${formParentItem}` : 'Create New Product Bundle'}
                  </h2>
                  <p className="text-xs text-gray-500">Define child items and stock availability rules</p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Scrollable Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-white">
              {/* Parent Item Code & Bundle Selling Rate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="block text-xs font-bold text-gray-700">Parent Item Code (Bundle Main Item)*</label>
                  <input
                    type="text"
                    disabled={isEditing}
                    placeholder="Search or enter Bundle Item Code..."
                    value={formParentItem}
                    onFocus={() => {
                      if (!isEditing && formParentItem) handleParentItemSearch(formParentItem);
                    }}
                    onChange={(e) => {
                      setFormParentItem(e.target.value);
                      if (!isEditing) handleParentItemSearch(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:bg-gray-50 font-mono font-bold text-gray-800"
                  />

                  {/* Parent Item Autocomplete Dropdown */}
                  {!isEditing && showParentDropdown && parentSearchResults.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-2xl z-[9999] max-h-48 overflow-y-auto divide-y divide-gray-100">
                      {parentSearchResults.map((item) => (
                        <div
                          key={item.item_code}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormParentItem(item.item_code);
                            if (item.standard_rate) setFormSellingRate(item.standard_rate);
                            setShowParentDropdown(false);
                          }}
                          className="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-gray-800 text-xs">{item.item_name}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{item.item_code}</p>
                          </div>
                          <span className="text-xs text-emerald-600 font-bold ml-2">
                            AED {item.standard_rate || item.rate || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-700">Overall Bundle Selling Rate (AED)</label>
                    {formItems.length > 0 && (
                      <span className="text-[10px] text-gray-400 font-semibold">
                        Sum: AED {formItems.reduce((acc, row) => acc + ((row.qty || 0) * (row.rate || 0)), 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={`e.g. ${formItems.reduce((acc, row) => acc + ((row.qty || 0) * (row.rate || 0)), 0).toFixed(2)}`}
                    value={formSellingRate}
                    onChange={(e) => setFormSellingRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-bold text-gray-900"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">Bundle Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of items included in this bundle..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-800"
                />
              </div>

              {/* Branch Availability Child Table */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">Branch Availability</label>
                <div className="flex flex-wrap gap-2">
                  {warehousesList.map((wh) => {
                    const whName = wh.name || wh;
                    const isChecked = formBranchAvailability.includes(whName);
                    return (
                      <button
                        key={whName}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setFormBranchAvailability(formBranchAvailability.filter(w => w !== whName));
                          } else {
                            setFormBranchAvailability([...formBranchAvailability, whName]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {wh.warehouse_name || whName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Child Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">Component Items *</label>
                  <button
                    type="button"
                    onClick={handleAddBundleRow}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="p-2.5 font-bold w-8 text-center">#</th>
                        <th className="p-2.5 font-bold">Child Item Code *</th>
                        <th className="p-2.5 font-bold w-24 text-center">Qty *</th>
                        <th className="p-2.5 font-bold w-24 text-center">UOM</th>
                        <th className="p-2.5 font-bold text-right w-28">Unit Rate (AED)</th>
                        <th className="p-2.5 font-bold text-center w-12">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {formItems.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/60">
                          <td className="p-2.5 text-gray-400 font-bold text-center">{idx + 1}</td>
                          <td className="p-2.5 relative">
                            <input
                              type="text"
                              placeholder="Search or enter Item Code..."
                              value={row.item_code}
                              onFocus={() => {
                                if (row.item_code) {
                                  handleItemSearch(row.item_code, idx);
                                }
                              }}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].item_code = e.target.value;
                                setFormItems(newItems);
                                handleItemSearch(e.target.value, idx);
                              }}
                              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-mono font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-gray-900"
                            />

                            {/* Dropdown Suggestions */}
                            {activeItemIndex === idx && itemSearchResults.length > 0 && (
                              <div className="absolute left-0 top-full mt-1 w-[280px] bg-white border border-gray-200 rounded-xl shadow-2xl z-[9999] max-h-48 overflow-y-auto divide-y divide-gray-100">
                                {itemSearchResults.map((item) => (
                                  <div
                                    key={item.item_code}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSelectChildItem(item, idx);
                                    }}
                                    className="p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors"
                                  >
                                    <div>
                                      <p className="font-semibold text-gray-800 text-xs">{item.item_name}</p>
                                      <p className="text-[10px] text-gray-500 font-mono">{item.item_code}</p>
                                    </div>
                                    <span className="text-xs text-emerald-600 font-bold ml-2">
                                      AED {item.rate || item.standard_rate || 0}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={row.qty}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].qty = parseFloat(e.target.value) || 0;
                                setFormItems(newItems);
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-center font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <select
                              value={row.uom || 'Nos'}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].uom = e.target.value;
                                setFormItems(newItems);
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-center font-semibold text-gray-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                            >
                              <option value="Nos">Nos</option>
                              <option value="Box">Box</option>
                              <option value="Piece">Piece</option>
                              <option value="Unit">Unit</option>
                              <option value="Kg">Kg</option>
                              <option value="Meter">Meter</option>
                              <option value="Pack">Pack</option>
                              <option value="Set">Set</option>
                            </select>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="number"
                              readOnly
                              disabled
                              value={row.rate !== undefined ? row.rate : 0}
                              placeholder="0.00"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right font-bold text-gray-700 bg-gray-100 cursor-not-allowed select-none"
                              title="Unit Rate is auto-fetched from item master"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveBundleRow(idx)}
                              className="p-1 text-gray-400 hover:text-red-600 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="p-4 px-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-200/80 rounded-xl transition border border-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveBundle}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition hover:opacity-95 active:scale-95"
                style={{ backgroundColor: themeColor }}
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditing ? 'Update Bundle' : 'Save Product Bundle'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bundle Details Drawer Modal */}
      {showDetailModal && selectedBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800 text-base">{selectedBundle.item_name}</h3>
                <p className="text-xs text-gray-400 font-mono">{selectedBundle.new_item_code}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-xs">
                <span className="text-gray-500">Calculated Bundle Total:</span>
                <span className="font-bold text-emerald-600 text-sm">
                  AED {selectedBundle.selling_price?.toFixed(2)}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700">Included Component Items</h4>
                <div className="space-y-2">
                  {(selectedBundle.items || []).map((item, idx) => (
                    <div key={idx} className="p-3 border border-gray-100 rounded-xl bg-white space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-800">{item.item_name || item.item_code}</span>
                        <span className="font-bold text-emerald-600">AED {(item.rate * item.qty).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>{item.qty} {item.uom} × AED {item.rate}</span>
                        <span>Stock: {item.actual_qty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 text-right bg-gray-50/50">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-white border border-gray-200 text-xs font-semibold text-gray-700 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductBundleList;
