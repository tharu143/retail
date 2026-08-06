import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  Boxes, Plus, Search, Filter, Trash2, Edit2, ChevronRight,
  Eye, CheckCircle2, AlertTriangle, Building2, Package, RefreshCw,
  X, Save, Layers, ArrowLeft, Loader2, Info, ShoppingBag, Printer, Globe, Mail, Phone
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { frappeCall } from '../../utils/frappe';
import './SalesOrder.css';
import '../../Pages/CustomerEditPage.css';

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

  // View Mode: 'list' or 'form'
  const [viewMode, setViewMode] = useState('list');
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
  const [activeChildResultIndex, setActiveChildResultIndex] = useState(-1);

  // Parent Item Search State
  const [parentSearchResults, setParentSearchResults] = useState([]);
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const [activeParentIndex, setActiveParentIndex] = useState(-1);

  // Field focus highlight state
  const [focusedField, setFocusedField] = useState(null);

  // Theme Sync
  const legacySubTheme = localStorage.getItem('legacySubTheme') || 'green';
  const isGreen = legacySubTheme === 'green';
  const themeColor = isGreen ? '#10b981' : '#0ea5e9';
  const themeColorHover = isGreen ? '#059669' : '#0284c7';
  const themeLight = isGreen ? '#f0fdf4' : '#f0f9ff';
  const themeRgb = isGreen ? '16, 185, 129' : '14, 165, 233';

  // IntersectionObserver for scroll-animate-card
  useEffect(() => {
    if (viewMode !== 'form') return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-slide-up-fade');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05 });

    const timer = setTimeout(() => {
      document.querySelectorAll('.scroll-animate-card').forEach(card => {
        observer.observe(card);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [viewMode]);

  // Input styles function matching SupplierEditPage
  const getInputStyle = (fieldId) => ({
    borderColor: focusedField === fieldId ? themeColor : '#cbd5e1',
    boxShadow: focusedField === fieldId ? `0 0 0 3px ${themeColor}15` : 'none',
    backgroundColor: '#ffffff',
    transition: 'all 0.2s ease-in-out',
    outline: 'none'
  });

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
      setActiveParentIndex(-1);
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
      setActiveParentIndex(items.length > 0 ? 0 : -1);
    } catch (err) {
      console.error('Error searching parent items:', err);
    }
  };

  // Parent Item Keyboard Navigation
  const handleParentKeyDown = (e) => {
    if (!showParentDropdown || parentSearchResults.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveParentIndex(prev => (prev < parentSearchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveParentIndex(prev => (prev > 0 ? prev - 1 : parentSearchResults.length - 1));
    } else if (e.key === 'Enter') {
      if (activeParentIndex >= 0 && activeParentIndex < parentSearchResults.length) {
        e.preventDefault();
        const item = parentSearchResults[activeParentIndex];
        setFormParentItem(item.item_code);
        if (item.standard_rate) setFormSellingRate(item.standard_rate);
        setShowParentDropdown(false);
        setActiveParentIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowParentDropdown(false);
      setActiveParentIndex(-1);
    }
  };

  // Search items for dropdown
  const handleItemSearch = async (query, index) => {
    setActiveItemIndex(index);
    if (!query || query.length < 1) {
      setItemSearchResults([]);
      setActiveChildResultIndex(-1);
      return;
    }
    try {
      setSearchingItems(true);
      const res = await frappeCall({
        method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_items_for_po',
        args: { query, warehouse: selectedBranch },
        type: 'POST'
      });
      let items = [];
      if (Array.isArray(res)) {
        items = res;
      } else if (res?.status === 'success') {
        items = res.data || [];
      }
      setItemSearchResults(items);
      setActiveChildResultIndex(items.length > 0 ? 0 : -1);
    } catch (err) {
      console.error('Error searching items:', err);
    } finally {
      setSearchingItems(false);
    }
  };

  // Child Item Keyboard Navigation
  const handleChildKeyDown = (e, index) => {
    if (activeItemIndex !== index || itemSearchResults.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveChildResultIndex(prev => (prev < itemSearchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveChildResultIndex(prev => (prev > 0 ? prev - 1 : itemSearchResults.length - 1));
    } else if (e.key === 'Enter') {
      if (activeChildResultIndex >= 0 && activeChildResultIndex < itemSearchResults.length) {
        e.preventDefault();
        const selectedItem = itemSearchResults[activeChildResultIndex];
        handleSelectChildItem(selectedItem, index);
        setActiveChildResultIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setActiveItemIndex(null);
      setActiveChildResultIndex(-1);
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
    setActiveChildResultIndex(-1);
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
    setViewMode('form');
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
    setViewMode('form');
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
        setViewMode('list');
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

  // Switch layouts dynamically
  if (viewMode === 'form') {
    return (
      <div 
        className="customer-edit-page pb-page-container flex flex-col font-sans bg-[#f5f6fa] min-h-screen relative z-50 pb-24"
        style={{ '--theme-color': themeColor || '#3b82f6' }}
      >
        <style>{`
          @import url('https://fonts.cdnfonts.com/css/gilroy-bold');
          .pb-page-container {
            font-family: 'Gilroy', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .pb-page-container input, 
          .pb-page-container select, 
          .pb-page-container textarea, 
          .pb-page-container button {
            font-family: 'Gilroy', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .pb-text-theme {
            color: ${themeColor} !important;
          }
          .pb-bg-theme {
            background-color: ${themeColor} !important;
          }
          .pb-bg-theme-light {
            background-color: ${themeLight} !important;
          }
          .pb-border-theme {
            border-color: ${themeColor} !important;
          }
          .pb-focus-theme:focus {
            border-color: ${themeColor} !important;
            box-shadow: 0 0 0 3px rgba(${themeRgb}, 0.15) !important;
          }
          .pb-hover-theme:hover {
            background-color: ${themeLight} !important;
            color: ${themeColor} !important;
          }
        `}</style>

        {/* Form Page Header - Inline top style set to 0 to prevent overlay gaps inside scroll container */}
        <div 
          style={{ top: 0, zIndex: 30 }}
          className="sticky top-[48px] bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-8 py-1.5 flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('list')}
              className="p-1.5 rounded-lg hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${themeColor}15`, color: themeColor }}>
                <Boxes size={16} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase leading-none">
                  {isEditing ? 'Edit Product Bundle' : 'New Product Bundle'}
                </h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Define items & availability rules</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('list')}
              className="px-4 py-1.5 font-bold text-slate-500 hover:text-slate-800 transition-colors text-[13px] cursor-pointer"
            >
              Discard
            </button>
            <button 
              onClick={handleSaveBundle} 
              disabled={saving} 
              className="px-5 py-1.5 text-white rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all hover:brightness-110 text-[13px] cursor-pointer" 
              style={{ backgroundColor: themeColor }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Saving...' : (isEditing ? 'Save Bundle' : 'Create Bundle')}</span>
            </button>
          </div>
        </div>

        {/* Form Body - Masonry Style Layout */}
        <div className="flex-1 overflow-y-auto bg-[#f5f6fa] p-4">
          <div className="w-full flex flex-col gap-4 pb-12">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-stretch">
              
              {/* Column 1: Bundle Specification */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs group hover:shadow-md transition-all duration-200 flex flex-col h-full scroll-animate-card">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white bg-slate-50/20">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: themeColor }}>
                      1
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none m-0">
                        Bundle Details
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 m-0">Basic bundle settings and price details</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Parent Item Code */}
                  <div className="space-y-1.5 col-span-1 md:col-span-2 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Parent Item Code (Bundle Main Item) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative w-full">
                      <input
                        type="text"
                        disabled={isEditing}
                        placeholder="Search or enter Bundle Item Code..."
                        value={formParentItem}
                        onFocus={() => {
                          setFocusedField('parent_item');
                          if (!isEditing && formParentItem) handleParentItemSearch(formParentItem);
                        }}
                        onBlur={() => {
                          setFocusedField(null);
                          // Delay dropdown close to allow mouse selection to register first
                          setTimeout(() => setShowParentDropdown(false), 200);
                        }}
                        onChange={(e) => {
                          setFormParentItem(e.target.value);
                          if (!isEditing) handleParentItemSearch(e.target.value);
                        }}
                        onKeyDown={handleParentKeyDown}
                        style={getInputStyle('parent_item')}
                        className="w-full border rounded-xl text-xs font-medium text-slate-700 font-mono transition-all duration-200 px-3 h-[38px]"
                      />
                      
                      {/* Autocomplete Suggestions */}
                      {!isEditing && showParentDropdown && parentSearchResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] max-h-56 overflow-y-auto divide-y divide-slate-100 py-1">
                          {parentSearchResults.map((item, idx) => {
                            const isSelected = idx === activeParentIndex;
                            return (
                              <div
                                key={item.item_code}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFormParentItem(item.item_code);
                                  if (item.standard_rate) setFormSellingRate(item.standard_rate);
                                  setShowParentDropdown(false);
                                }}
                                style={isSelected ? { backgroundColor: `${themeColor}12`, borderLeft: `3px solid ${themeColor}` } : {}}
                                className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors text-left pl-3"
                              >
                                <div>
                                  <p className="font-bold text-slate-800 text-xs">{item.item_name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono font-semibold">{item.item_code}</p>
                                </div>
                                <span className="text-xs pb-text-theme font-black ml-2 flex-shrink-0">
                                  AED {item.standard_rate || item.rate || 0}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Overall Bundle Selling Rate */}
                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                        Overall Bundle Selling Rate (AED) <span className="text-rose-500">*</span>
                      </label>
                      {formItems.length > 0 && (
                        <span className="text-[9px] text-slate-400 font-black uppercase">
                          Sum: AED {formItems.reduce((acc, row) => acc + ((row.qty || 0) * (row.rate || 0)), 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`e.g. ${formItems.reduce((acc, row) => acc + ((row.qty || 0) * (row.rate || 0)), 0).toFixed(2)}`}
                      value={formSellingRate}
                      onFocus={() => setFocusedField('selling_rate')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => setFormSellingRate(e.target.value)}
                      style={getInputStyle('selling_rate')}
                      className="w-full border rounded-xl text-xs font-bold text-slate-800 transition-all duration-200 px-3 h-[38px]"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5 col-span-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-0.5">
                      Bundle Description
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Brief description of items included in this bundle..."
                      value={formDescription}
                      onFocus={() => setFocusedField('description')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => setFormDescription(e.target.value)}
                      style={{ ...getInputStyle('description'), height: '76px' }}
                      className="w-full p-3 border rounded-xl text-xs font-medium text-slate-700 transition-all duration-200 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Column 2: Branch Availability */}
              <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs group hover:shadow-md transition-all duration-200 flex flex-col h-full scroll-animate-card">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white bg-slate-50/20">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: themeColor }}>
                      2
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none m-0">
                        Branch Availability
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 m-0">Select warehouses where this bundle is active</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {warehousesList.map((wh) => {
                      const whName = wh.name || wh;
                      const isChecked = formBranchAvailability.includes(whName);
                      return (
                        <label
                          key={whName}
                          className="flex items-center gap-3 p-3 rounded-xl border border-slate-150 hover:bg-slate-50/50 cursor-pointer transition-all duration-150 select-none"
                          style={isChecked ? { borderColor: `${themeColor}40`, backgroundColor: `${themeColor}05` } : {}}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setFormBranchAvailability(formBranchAvailability.filter(w => w !== whName));
                              } else {
                                setFormBranchAvailability([...formBranchAvailability, whName]);
                              }
                            }}
                            style={{
                              accentColor: themeColor,
                              width: '15px',
                              height: '15px',
                              cursor: 'pointer'
                            }}
                          />
                          <span className="text-xs font-bold text-slate-700 transition-colors" style={isChecked ? { color: themeColor } : {}}>
                            {wh.warehouse_name || whName}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              
            </div>

            {/* Row 3: Component Items */}
            <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs group hover:shadow-md transition-all duration-200 scroll-animate-card mt-2">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-white bg-slate-50/20">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: themeColor }}>
                    3
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none m-0">
                      Component Items
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 m-0">Include child items and their respective quantities</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleAddBundleRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
                  style={{ color: themeColor, borderColor: `${themeColor}30`, backgroundColor: `${themeColor}0a` }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Component
                </button>
              </div>
              
              <div className="p-4">
                <div className="border border-slate-200 rounded-xl shadow-xs relative">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="text-white border-none" style={{ backgroundColor: themeColor }}>
                      <tr>
                        <th style={{ padding: '10px 14px', width: '50px' }} className="font-bold text-center">#</th>
                        <th style={{ padding: '10px 14px' }} className="font-bold">Child Item Code *</th>
                        <th style={{ padding: '10px 14px', width: '120px' }} className="font-bold text-center">Qty *</th>
                        <th style={{ padding: '10px 14px', width: '140px' }} className="font-bold text-center">UOM</th>
                        <th style={{ padding: '10px 14px', width: '160px' }} className="font-bold text-right">Unit Rate (AED)</th>
                        <th style={{ padding: '10px 14px', width: '60px' }} className="font-bold text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {formItems.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td style={{ padding: '8px 12px' }} className="text-slate-400 font-bold text-center">{idx + 1}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <div className="relative w-full">
                              <input
                                type="text"
                                placeholder="Search or enter Item Code..."
                                value={row.item_code}
                                onFocus={() => {
                                  setActiveItemIndex(idx);
                                  if (row.item_code) {
                                    handleItemSearch(row.item_code, idx);
                                  }
                                }}
                                onBlur={() => {
                                  // Delay dropdown close to allow mouse selection to register first
                                  setTimeout(() => {
                                    if (activeItemIndex === idx) {
                                      setActiveItemIndex(null);
                                      setActiveChildResultIndex(-1);
                                    }
                                  }, 200);
                                }}
                                onChange={(e) => {
                                  const newItems = [...formItems];
                                  newItems[idx].item_code = e.target.value;
                                  setFormItems(newItems);
                                  handleItemSearch(e.target.value, idx);
                                }}
                                onKeyDown={(e) => handleChildKeyDown(e, idx)}
                                className="w-full h-[38px] px-3 border rounded-lg text-xs font-semibold font-mono text-slate-800 transition-all focus:outline-none"
                                style={getInputStyle(`item_code_${idx}`)}
                              />
                              
                              {/* Suggestions dropdown */}
                              {activeItemIndex === idx && itemSearchResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] max-h-48 overflow-y-auto divide-y divide-slate-100 py-1">
                                  {itemSearchResults.map((item, cIdx) => {
                                    const isSelected = cIdx === activeChildResultIndex;
                                    return (
                                      <div
                                        key={item.item_code}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          handleSelectChildItem(item, idx);
                                        }}
                                        style={isSelected ? { backgroundColor: `${themeColor}12`, borderLeft: `3px solid ${themeColor}` } : {}}
                                        className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors text-left pl-3"
                                      >
                                        <div>
                                          <p className="font-bold text-slate-800 text-xs">{item.item_name}</p>
                                          <p className="text-[10px] text-slate-400 font-mono font-semibold">{item.item_code}</p>
                                        </div>
                                        <span className="text-xs pb-text-theme font-black ml-2 flex-shrink-0">
                                          AED {item.rate || item.standard_rate || 0}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
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
                              className="w-full h-[38px] px-3 border rounded-lg text-xs font-bold text-center text-slate-800 focus:outline-none"
                              style={getInputStyle(`qty_${idx}`)}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={row.uom || 'Nos'}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].uom = e.target.value;
                                setFormItems(newItems);
                              }}
                              className="w-full h-[38px] px-3 border rounded-lg text-xs font-bold text-slate-700 bg-white focus:outline-none cursor-pointer"
                              style={getInputStyle(`uom_${idx}`)}
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
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="number"
                              readOnly
                              disabled
                              value={row.rate !== undefined ? row.rate : 0}
                              placeholder="0.00"
                              className="w-full h-[38px] px-3 border border-slate-200 rounded-lg text-xs text-right font-bold text-slate-400 bg-slate-50/50 cursor-not-allowed select-none"
                              title="Unit Rate is auto-fetched from item master"
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }} className="text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveBundleRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center mx-auto"
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
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="so-page pb-page-container" style={{ height: 'auto', minHeight: '100vh', overflow: 'visible' }}>
      <style>{`
        @import url('https://fonts.cdnfonts.com/css/gilroy-bold');
        .pb-page-container {
          font-family: 'Gilroy', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .pb-page-container input, 
        .pb-page-container select, 
        .pb-page-container textarea, 
        .pb-page-container button {
          font-family: 'Gilroy', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .pb-text-theme {
          color: ${themeColor} !important;
        }
        .pb-bg-theme {
          background-color: ${themeColor} !important;
        }
        .pb-bg-theme-light {
          background-color: ${themeLight} !important;
        }
        .pb-border-theme {
          border-color: ${themeColor} !important;
        }
        .pb-focus-theme:focus {
          border-color: ${themeColor} !important;
          box-shadow: 0 0 0 3px rgba(${themeRgb}, 0.15) !important;
        }
        .pb-hover-theme:hover {
          background-color: ${themeLight} !important;
          color: ${themeColor} !important;
        }
      `}</style>

      {/* Page Header */}
      <div className="so-page-header-container">
        <div className="so-page-tabs">
          <span className="so-page-tab active">Product Bundles</span>
        </div>
        <div className="so-page-header">
          <div>
            <h1 className="so-page-title">Product Bundles</h1>
            <p className="so-page-subtitle">Manage item bundles, prices & branch availability</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={fetchBundles}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem', background: '#f8fafc',
                border: `1.5px solid ${themeColor}`, borderRadius: '0.375rem',
                fontSize: '0.75rem', fontWeight: 700, color: themeColor,
                cursor: 'pointer', transition: 'all 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button className="so-btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={16} /> Create Product Bundle
            </button>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="so-filter-bar">
        <div style={{ flex: '1 1 250px' }}>
          <label className="so-filter-label">Search Bundle</label>
          <input
            className="so-filter-input"
            type="text"
            placeholder="Search Bundle Code / Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label className="so-filter-label">Item Group</label>
          <select className="so-filter-input" value={selectedItemGroup} onChange={(e) => setSelectedItemGroup(e.target.value)}>
            {itemGroups.map((grp) => (
              <option key={grp} value={grp}>{grp === 'All' ? 'All Item Groups' : grp}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label className="so-filter-label">Warehouse / Branch</label>
          <select className="so-filter-input" value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            <option value="">All Warehouses / Branches</option>
            {warehousesList.map((wh) => (
              <option key={wh.name || wh} value={wh.name || wh}>{wh.warehouse_name || wh.name || wh}</option>
            ))}
          </select>
        </div>
        <button className="so-clear-btn" style={{ width: 'auto', padding: '0 1.5rem', height: '38px', margin: 0 }} onClick={() => {
          setSearchTerm(''); setSelectedItemGroup('All'); setSelectedBranch(warehouse || '');
        }}>Reset</button>
      </div>

      {/* Main Directory Table */}
      <div style={{ padding: '1.5rem 2rem' }}>
        <div className="so-table-card">
          <div className="so-table-wrapper" style={{ maxHeight: 'none', overflowY: 'visible' }}>
            <table className="so-table">
              <thead>
                <tr>
                  <th>Bundle Item</th>
                  <th>Item Group</th>
                  <th>Selling Price</th>
                  <th>Included Component Items</th>
                  <th>Availability</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="so-empty">
                      <Loader2 size={28} className="so-spinner" style={{ margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : bundles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="so-empty">
                      <Package size={36} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
                      <p>No product bundles match the current filters.</p>
                    </td>
                  </tr>
                ) : (
                  bundles.map((bundle) => (
                    <tr key={bundle.name} onClick={() => { setSelectedBundle(bundle); setShowDetailModal(true); }} style={{ cursor: 'pointer' }}>
                      {/* Bundle Item */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '0.625rem',
                            background: themeLight, color: themeColor,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Boxes size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--so-text-heading)', fontSize: '0.85rem' }}>{bundle.item_name}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--so-text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>{bundle.new_item_code}</div>
                          </div>
                        </div>
                      </td>

                      {/* Item Group */}
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                          {bundle.item_group || 'Bundle'}
                        </span>
                      </td>

                      {/* Selling Price */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, color: 'var(--so-text-heading)', fontSize: '0.85rem' }}>
                          <DirhamIcon className="w-3.5 h-3.5 mr-1" />
                          <span>{bundle.selling_price?.toFixed(2)}</span>
                          {bundle.calculated_price !== bundle.selling_price && (
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', textDecoration: 'line-through', marginLeft: '0.5rem', fontWeight: 500 }}>
                              AED {bundle.calculated_price?.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Included Component Items */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '350px' }}>
                          {(bundle.items || []).map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', gap: '0.5rem', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 800, color: themeColor, fontSize: '0.75rem' }}>{item.qty}x</span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#334155' }}>{item.item_name || item.item_code}</span>
                              </div>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ml-auto flex-shrink-0 ${
                                item.actual_qty > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-655 border border-red-100'
                              }`}>
                                {item.actual_qty || 0} {item.uom}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Availability */}
                      <td>
                        <span
                          className="so-badge font-black uppercase text-[10px]"
                          style={
                            bundle.available_bundle_qty > 0
                              ? { background: themeLight, color: themeColor, borderColor: themeColor }
                              : { background: '#fef3c7', color: '#d97706', borderColor: '#fcd34d' }
                          }
                        >
                          {bundle.available_bundle_qty} sets available
                        </span>
                      </td>

                      {/* Controls / Actions */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBundle(bundle);
                              setShowDetailModal(true);
                            }}
                            className="so-btn-ghost p-1.5"
                            title="View Details"
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(bundle)}
                            className="so-btn-ghost p-1.5"
                            title="Edit Bundle"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBundle(bundle)}
                            className="so-btn-ghost p-1.5"
                            title="Delete Bundle"
                          >
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bundle Details Drawer Modal */}
      {showDetailModal && selectedBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">{selectedBundle.item_name}</h3>
                <p className="text-xs text-slate-400 font-mono font-bold">{selectedBundle.new_item_code}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-100">
                <span className="text-slate-500 font-bold">Calculated Bundle Total:</span>
                <span className="font-black pb-text-theme text-sm">
                  AED {selectedBundle.selling_price?.toFixed(2)}
                </span>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Included Component Items</h4>
                <div className="space-y-2">
                  {(selectedBundle.items || []).map((item, idx) => (
                    <div key={idx} className="p-3 border border-slate-150 rounded-xl bg-white space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{item.item_name || item.item_code}</span>
                        <span className="font-black pb-text-theme">AED {(item.rate * item.qty).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-450">
                        <span>{item.qty} {item.uom} × AED {item.rate}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.actual_qty > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-655'}`}>Stock: {item.actual_qty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 text-right bg-slate-50/50">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-xs font-bold text-slate-650 rounded-xl cursor-pointer"
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
