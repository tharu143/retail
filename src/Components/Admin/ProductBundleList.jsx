import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  Boxes, Plus, Search, Filter, Trash2, Edit2, ChevronRight,
  Eye, CheckCircle2, AlertTriangle, Building2, Package, RefreshCw,
  X, Save, Layers, ArrowLeft, Loader2, Info, ShoppingBag, Printer, Globe, Mail, Phone, MoreVertical
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import DirhamIcon from '../../assets/Currency/DirhamIcon';
import { frappeCall } from '../../utils/frappe';
import '../../Pages/CustomerEditPage.css';
import './BundleDetailsModal.css';
import './ProductBundleList.css';
import CustomSearchDropdown from '../Purchase/CustomSearchDropdown';

const ProductBundleList = () => {
  const navigate = useNavigate();
  const { warehouse, user_roles } = useSelector(state => state.user || {});
  const isAdmin = (user_roles || []).includes("Administrator") || (user_roles || []).includes("System Manager");

  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemGroup, setSelectedItemGroup] = useState('All');
  const [itemGroups, setItemGroups] = useState(['All']);
  const [allItemGroups, setAllItemGroups] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(warehouse || '');

  // View Mode: 'list' or 'form'
  const [viewMode, setViewMode] = useState('list');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Quick Create Parent Item Modal State
  const [showQuickCreateParentModal, setShowQuickCreateParentModal] = useState(false);
  const [quickParentCode, setQuickParentCode] = useState('');
  const [quickParentName, setQuickParentName] = useState('');
  const [quickParentMainGroup, setQuickParentMainGroup] = useState('');
  const [quickParentSubGroup, setQuickParentSubGroup] = useState('');
  const [groupHierarchy, setGroupHierarchy] = useState([]);
  const [quickCreatingParent, setQuickCreatingParent] = useState(false);

  // Theme Sync
  const legacySubTheme = localStorage.getItem('legacySubTheme') || 'blue';
  const isGreen = legacySubTheme === 'green';
  const themeColor = '#0082f6';
  const themeColorHover = '#006ed4';
  const themeLight = '#eff6ff';
  const themeRgb = '0, 130, 246';

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
      const [groupsRes, allGroupsRes, whRes, hierarchyRes] = await Promise.all([
        frappeCall({
          method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_bundle_item_groups',
          type: 'POST'
        }),
        frappeCall({
          method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups',
          type: 'GET'
        }),
        frappeCall({
          method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_warehouses',
          type: 'POST'
        }),
        frappeCall({
          method: 'custom_retailpos.custom_pos_features.get_item_group_hierarchy',
          type: 'GET'
        })
      ]);
      if (groupsRes?.status === 'success') {
        setItemGroups(['All', ...(groupsRes.data || [])]);
      }
      if (allGroupsRes?.success && Array.isArray(allGroupsRes.data)) {
        setAllItemGroups(allGroupsRes.data);
      } else if (Array.isArray(allGroupsRes)) {
        setAllItemGroups(allGroupsRes);
      }
      if (whRes?.status === 'success') {
        setWarehousesList(whRes.data || []);
      }
      if (hierarchyRes?.status === 'success' || hierarchyRes?.message?.status === 'success') {
        const hList = hierarchyRes.hierarchy || hierarchyRes.message?.hierarchy || [];
        setGroupHierarchy(hList);
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
        method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_parent_items_for_bundle',
        args: { query, warehouse: selectedBranch },
        type: 'POST'
      });
      let items = [];
      if (Array.isArray(res)) {
        items = res;
      } else if (res?.status === 'success' || res?.success) {
        items = res.data || [];
      }
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

  // Quick Create Parent Item (Non-Stock, Non-Purchase, Sales-Allowed Item)
  const handleQuickCreateParent = async (e) => {
    if (e) e.preventDefault();
    if (!quickParentCode.trim() || !quickParentName.trim()) {
      Swal.fire('Required Fields', 'Please enter Item Code and Item Name.', 'warning');
      return;
    }
    const extractName = (val) => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      return val.name || val.value || val.item_group_name || val.label || '';
    };

    const subName = extractName(quickParentSubGroup);
    const mainName = extractName(quickParentMainGroup);
    const finalGroup = subName || mainName || (itemGroups.find(g => g !== 'All') || 'All Item Groups');
    try {
      setQuickCreatingParent(true);
      const res = await frappeCall({
        method: 'custom_retailpos.custom_retailpos.retail_api.retail.create_item',
        args: {
          item_code: quickParentCode.trim(),
          item_name: quickParentName.trim(),
          item_group: finalGroup,
          default_uom: 'Nos',
          maintain_stock: 0, // Non-Stock Item
          standard_selling_rate: 0,
          description: `Product Bundle Parent Item for ${quickParentName.trim()}`
        },
        type: 'POST'
      });

      if (res?.success || res?.status === 'success') {
        Swal.fire({
          icon: 'success',
          title: 'Parent Item Created!',
          text: `Non-stock item ${quickParentCode.trim()} created successfully under ${finalGroup}.`,
          timer: 1500,
          showConfirmButton: false
        });
        setFormParentItem(quickParentCode.trim());
        setShowQuickCreateParentModal(false);
        setQuickParentCode('');
        setQuickParentName('');
        setQuickParentMainGroup('');
        setQuickParentSubGroup('');
      } else {
        Swal.fire('Error', res?.message || 'Failed to create parent item', 'error');
      }
    } catch (err) {
      console.error('Error quick creating parent item:', err);
      Swal.fire('Error', err.message || 'Failed to create item', 'error');
    } finally {
      setQuickCreatingParent(false);
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
        method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_items_for_bundle',
        args: { query, warehouse: selectedBranch },
        type: 'POST'
      });
      let items = [];
      if (Array.isArray(res)) {
        items = res;
      } else if (res?.status === 'success' || res?.success) {
        items = res.data || [];
      }
      setItemSearchResults(items);
      setActiveChildResultIndex(items.length > 0 ? 0 : -1);
    } catch (err) {
      console.error('Error searching bundle items:', err);
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
    // Filter warehouses for availability: Admins see all, cashiers see only their assigned branch
    const availableWarehouses = isAdmin 
      ? warehousesList 
      : warehousesList.filter(wh => (wh.name || wh) === warehouse || (wh.warehouse_name || '') === warehouse);

    return (
      <div className="pbl-container">
        {/* Modern Sticky Header */}
        <header className="pbl-header">
          <div className="pbl-header-left">
            <button
              onClick={() => setViewMode('list')}
              className="pbl-btn-secondary"
              style={{ padding: '0.5rem', width: '38px', height: '38px', justifyContent: 'center' }}
              title="Back to List"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="pbl-header-icon">
              <Boxes size={22} />
            </div>
            <div>
              <div className="pbl-title-row">
                <h1 className="pbl-title">
                  {isEditing ? 'Edit Product Bundle' : 'New Product Bundle'}
                </h1>
                <span className="pbl-tag">{isEditing ? 'Modify Mode' : 'Creation Mode'}</span>
              </div>
              <p className="pbl-subtitle">Configure bundle items, pricing and warehouse branch distribution</p>
            </div>
          </div>

          <div className="pbl-header-actions">
            <button
              onClick={() => setViewMode('list')}
              className="pbl-btn-secondary"
            >
              Cancel & Discard
            </button>
            <button 
              onClick={handleSaveBundle} 
              disabled={saving} 
              className="pbl-btn-primary"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Bundle')}</span>
            </button>
          </div>
        </header>

        {/* Form Body */}
        <div className="pbl-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* Card 1: Bundle Details */}
            <div className="pbl-card">
              <div className="pbl-card-header">
                <div className="pbl-card-header-left">
                  <div className="pbl-card-num-badge">1</div>
                  <div>
                    <h3 className="pbl-card-title">Bundle Details</h3>
                    <p className="pbl-card-desc">Basic bundle settings and price details</p>
                  </div>
                </div>
              </div>
              
              <div className="pbl-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {/* Parent Item Code */}
                <div className="pbl-field-group relative">
                  <div className="pbl-field-label">
                    <span>Parent Item Code (Bundle Main Item) <span style={{ color: '#ef4444' }}>*</span></span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickParentCode(formParentItem || '');
                          setQuickParentName(formParentItem || '');
                          setShowQuickCreateParentModal(true);
                        }}
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          color: '#2563eb',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={12} /> Quick Create Non-Stock Item
                      </button>
                    )}
                  </div>

                  <div style={{ position: 'relative', width: '100%' }}>
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
                        setTimeout(() => setShowParentDropdown(false), 250);
                      }}
                      onChange={(e) => {
                        setFormParentItem(e.target.value);
                        if (!isEditing) handleParentItemSearch(e.target.value);
                      }}
                      onKeyDown={handleParentKeyDown}
                      className="pbl-input"
                      style={{ fontFamily: 'monospace', fontWeight: 700 }}
                    />
                    
                    {/* Parent Autocomplete Dropdown */}
                    {!isEditing && showParentDropdown && parentSearchResults.length > 0 && (
                      <div className="pbl-autocomplete-dropdown" style={{ width: '100%' }}>
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
                              className={`pbl-autocomplete-item ${isSelected ? 'active' : ''}`}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="pbl-autocomplete-title truncate">{item.item_name}</div>
                                <div className="pbl-autocomplete-code">{item.item_code}</div>
                              </div>
                              <span className="pbl-autocomplete-price">
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
                <div className="pbl-field-group">
                  <div className="pbl-field-label">
                    <span>Overall Bundle Selling Rate (AED) <span style={{ color: '#ef4444' }}>*</span></span>
                    {formItems.length > 0 && (
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800 }}>
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
                    className="pbl-input"
                    style={{ fontWeight: 800 }}
                  />
                </div>

                {/* Description */}
                <div className="pbl-field-group">
                  <div className="pbl-field-label">Bundle Description</div>
                  <textarea
                    rows={3}
                    placeholder="Brief description of items included in this bundle..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="pbl-textarea"
                    style={{ height: '76px', resize: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Branch Availability */}
            <div className="pbl-card">
              <div className="pbl-card-header">
                <div className="pbl-card-header-left">
                  <div className="pbl-card-num-badge">2</div>
                  <div>
                    <h3 className="pbl-card-title">Branch Availability</h3>
                    <p className="pbl-card-desc">
                      {isAdmin ? 'Select stores and warehouses where this bundle is active' : 'Assigned branch for your cashier account'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="pbl-card-body">
                <div className="pbl-branch-grid">
                  {availableWarehouses.map((wh) => {
                    const whName = wh.name || wh;
                    const displayName = wh.warehouse_name || whName;
                    const isChecked = formBranchAvailability.includes(whName);
                    return (
                      <div
                        key={whName}
                        onClick={() => {
                          if (isChecked) {
                            setFormBranchAvailability(formBranchAvailability.filter(w => w !== whName));
                          } else {
                            setFormBranchAvailability([...formBranchAvailability, whName]);
                          }
                        }}
                        className={`pbl-branch-item ${isChecked ? 'active' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled by outer div click
                          className="pbl-branch-checkbox"
                        />
                        <span className="pbl-branch-name truncate">
                          {displayName}
                        </span>
                      </div>
                    );
                  })}
                  {availableWarehouses.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
                      No active branches available.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>

          {/* Card 3: Component Items */}
          <div className="pbl-card">
            <div className="pbl-card-header">
              <div className="pbl-card-header-left">
                <div className="pbl-card-num-badge">3</div>
                <div>
                  <h3 className="pbl-card-title">Component Items</h3>
                  <p className="pbl-card-desc">Include child items and their respective quantities</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={handleAddBundleRow}
                className="pbl-btn-secondary"
                style={{ color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}
              >
                <Plus size={15} /> Add Component Item
              </button>
            </div>
            
            <div className="pbl-card-body">
              <div className="pbl-table-wrapper">
                <table className="pbl-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                      <th style={{ width: '160px' }}>Child Item Code *</th>
                      <th style={{ minWidth: '280px' }}>Item Name</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Qty *</th>
                      <th style={{ width: '110px', textAlign: 'center' }}>UOM</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Unit Rate (AED)</th>
                      <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#94a3b8' }}>
                          {idx + 1}
                        </td>
                        <td>
                          <div style={{ position: 'relative', width: '100%' }}>
                            <input
                              type="text"
                              placeholder="Search code..."
                              value={row.item_code}
                              onFocus={() => {
                                setActiveItemIndex(idx);
                                if (row.item_code) handleItemSearch(row.item_code, idx);
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  if (activeItemIndex === idx) {
                                    setActiveItemIndex(null);
                                    setActiveChildResultIndex(-1);
                                  }
                                }, 250);
                              }}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].item_code = e.target.value;
                                setFormItems(newItems);
                                handleItemSearch(e.target.value, idx);
                              }}
                              onKeyDown={(e) => handleChildKeyDown(e, idx)}
                              className="pbl-input"
                              style={{ fontFamily: 'monospace', fontWeight: 700 }}
                            />
                            
                            {/* Child Item Suggestions dropdown */}
                            {activeItemIndex === idx && itemSearchResults.length > 0 && (
                              <div className="pbl-autocomplete-dropdown">
                                {itemSearchResults.map((item, cIdx) => {
                                  const isSelected = cIdx === activeChildResultIndex;
                                  return (
                                    <div
                                      key={item.item_code}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelectChildItem(item, idx);
                                      }}
                                      className={`pbl-autocomplete-item ${isSelected ? 'active' : ''}`}
                                    >
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div className="pbl-autocomplete-title truncate">{item.item_name}</div>
                                        <div className="pbl-autocomplete-code">{item.item_code}</div>
                                      </div>
                                      <span className="pbl-autocomplete-price">
                                        AED {item.rate || item.standard_rate || 0}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <input
                            type="text"
                            placeholder="Item Name (auto-filled)"
                            value={row.item_name || ''}
                            title={row.item_name || ''}
                            onChange={(e) => {
                              const newItems = [...formItems];
                              newItems[idx].item_name = e.target.value;
                              setFormItems(newItems);
                            }}
                            className="pbl-input"
                            style={{ fontWeight: 700, color: '#1e293b', width: '100%' }}
                          />
                        </td>
                        <td>
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
                            className="pbl-input"
                            style={{ textAlign: 'center', fontWeight: 800 }}
                          />
                        </td>
                        <td>
                          <select
                            value={row.uom || 'Nos'}
                            onChange={(e) => {
                              const newItems = [...formItems];
                              newItems[idx].uom = e.target.value;
                              setFormItems(newItems);
                            }}
                            className="pbl-select"
                            style={{ fontWeight: 700, cursor: 'pointer' }}
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
                        <td>
                          <input
                            type="number"
                            readOnly
                            disabled
                            value={row.rate !== undefined ? row.rate : 0}
                            placeholder="0.00"
                            className="pbl-input"
                            style={{ textAlign: 'right', fontWeight: 800, background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                            title="Unit Rate is auto-fetched from item master"
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveBundleRow(idx)}
                            className="pbl-btn-secondary"
                            style={{ padding: '0.45rem', border: 'none', color: '#ef4444' }}
                            title="Remove Row"
                          >
                            <Trash2 size={16} />
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

        {/* ==================== QUICK CREATE PARENT ITEM MODAL (FORM VIEW) ==================== */}
        {showQuickCreateParentModal && (
          <div className="pbl-modal-backdrop">
            <div className="pbl-modal-card">
              <div style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Quick Create Parent Item</h3>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, margin: '2px 0 0' }}>Non-Stock Combo Wrapper Item</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickCreateParentModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleQuickCreateParent} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div style={{ padding: '0.85rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', display: 'flex', gap: '0.6rem', fontSize: '0.78rem', color: '#065f46' }}>
                  <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    This creates a <strong>Non-Stock Item</strong> (Maintain Stock = NO) specifically for this Product Bundle.
                  </span>
                </div>

                <div className="pbl-field-group">
                  <label className="pbl-filter-label">
                    Parent Item Code <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. COMBO-RAMADAN-GIFT"
                    value={quickParentCode}
                    onChange={(e) => setQuickParentCode(e.target.value.toUpperCase())}
                    className="pbl-input"
                    style={{ fontFamily: 'monospace', fontWeight: 800 }}
                  />
                </div>

                <div className="pbl-field-group">
                  <label className="pbl-filter-label">
                    Item Name / Bundle Title <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramadan Special Gift Box"
                    value={quickParentName}
                    onChange={(e) => setQuickParentName(e.target.value)}
                    className="pbl-input"
                    style={{ fontWeight: 700 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="pbl-field-group">
                    <label className="pbl-filter-label">
                      Main Group <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <CustomSearchDropdown
                      placeholder="Select Main Group..."
                      value={quickParentMainGroup}
                      onSelect={(val) => {
                        const name = typeof val === 'string' ? val : (val?.name || val?.value || val?.label || '');
                        setQuickParentMainGroup(name);
                        setQuickParentSubGroup('');
                      }}
                      fetchData={async (query) => {
                        let mainList = [];
                        if (groupHierarchy && groupHierarchy.length > 0) {
                          mainList = groupHierarchy.map(h => h.main_group || h.name).filter(Boolean);
                        }
                        if (mainList.length === 0) {
                          mainList = ['Stationery Products', 'Products', 'All Item Groups'];
                        }
                        const filtered = query ? mainList.filter(m => m.toLowerCase().includes(query.toLowerCase())) : mainList;
                        return filtered.map(m => ({ name: m, label: m }));
                      }}
                      optionsLabel="label"
                      themeColor={themeColor}
                    />
                  </div>

                  <div className="pbl-field-group">
                    <label className="pbl-filter-label">Subgroup</label>
                    <CustomSearchDropdown
                      placeholder={quickParentMainGroup ? "Select Subgroup..." : "Choose Main Group first"}
                      disabled={!quickParentMainGroup}
                      value={quickParentSubGroup}
                      onSelect={(val) => {
                        const name = typeof val === 'string' ? val : (val?.name || val?.value || val?.label || '');
                        setQuickParentSubGroup(name);
                      }}
                      fetchData={async (query) => {
                        if (!quickParentMainGroup) return [];
                        const match = (groupHierarchy || []).find(h => (h.main_group || h.name) === quickParentMainGroup);
                        let subList = [];
                        if (match && Array.isArray(match.subgroups)) {
                          subList = match.subgroups.map(s => (typeof s === 'string' ? s : (s.name || s.item_group_name || s.label))).filter(Boolean);
                        }
                        if (subList.length === 0) {
                          try {
                            const res = await frappeCall({
                              method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups',
                              args: { search: query || '' },
                              type: 'GET'
                            });
                            const raw = res?.data || res || [];
                            subList = (Array.isArray(raw) ? raw : []).map(g => g.value || g.name || g.item_group_name || g.label || g);
                          } catch {
                            subList = [];
                          }
                        }
                        const filtered = query ? subList.filter(s => s.toLowerCase().includes(query.toLowerCase())) : subList;
                        return filtered.map(s => ({ name: s, label: s }));
                      }}
                      optionsLabel="label"
                      themeColor={themeColor}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={() => setShowQuickCreateParentModal(false)}
                    className="pbl-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quickCreatingParent}
                    className="pbl-btn-primary"
                  >
                    {quickCreatingParent ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Creating...
                      </>
                    ) : (
                      <>
                        <Save size={15} /> Create Parent Item
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== LIST VIEW (MODERN REDESIGNED DIRECTORY) ====================
  return (
    <div className="pbl-container">
      {/* Sticky Header */}
      <header className="pbl-header">
        <div className="pbl-header-left" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <h1 className="pbl-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Package size={22} style={{ color: '#0082f6' }} strokeWidth={2.5} />
            <span style={{ fontFamily: "'Outfit', 'Gilroy', sans-serif", fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
              PRODUCT BUNDLES
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', marginLeft: '4px' }}>
              {bundles.length} ACTIVE BUNDLES
            </span>
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
            Manage item bundles, component stocks &amp; branch availability
          </p>
        </div>

        <div className="pbl-header-actions">
          <button
            onClick={fetchBundles}
            className="pbl-btn-secondary"
            style={{ height: '38px', borderRadius: '8px', padding: '0 16px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            title="Refresh Bundle Directory"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>REFRESH</span>
          </button>
          <button 
            className="pbl-btn-primary" 
            style={{ height: '38px', borderRadius: '8px', padding: '0 16px', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#0082f6' }}
            onClick={handleOpenCreateModal}
          >
            <Plus size={16} />
            <span>CREATE BUNDLE</span>
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="pbl-filters">
        <div className="pbl-filter-group" style={{ flex: '1 1 260px' }}>
          <label className="pbl-filter-label">Search Bundle</label>
          <input
            className="pbl-filter-input"
            type="text"
            placeholder="Search bundle code or item name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="pbl-filter-group" style={{ flex: '1 1 200px' }}>
          <label className="pbl-filter-label">Item Group</label>
          <select 
            className="pbl-filter-select" 
            value={selectedItemGroup} 
            onChange={(e) => setSelectedItemGroup(e.target.value)}
          >
            {itemGroups.map((grp) => (
              <option key={grp} value={grp}>{grp === 'All' ? 'All Item Groups' : grp}</option>
            ))}
          </select>
        </div>

        <div className="pbl-filter-group" style={{ flex: '1 1 200px' }}>
          <label className="pbl-filter-label">Branch / Warehouse</label>
          <select
            className="pbl-filter-select"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            disabled={!isAdmin}
            style={!isAdmin ? { opacity: 0.75, cursor: 'not-allowed', backgroundColor: '#f8fafc' } : {}}
          >
            {isAdmin && <option value="">All Warehouses / Branches</option>}
            {warehousesList
              .filter(wh => isAdmin || (wh.name || wh) === warehouse || (wh.warehouse_name || '') === warehouse)
              .map((wh) => (
                <option key={wh.name || wh} value={wh.name || wh}>
                  {wh.warehouse_name || wh.name || wh}
                </option>
              ))}
          </select>
        </div>

        <button 
          className="pbl-btn-secondary" 
          style={{ height: '42px', padding: '0 1.25rem' }} 
          onClick={() => {
            setSearchTerm(''); 
            setSelectedItemGroup('All'); 
            setSelectedBranch(warehouse || '');
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Main Directory Content */}
      <div className="pbl-content">
        <div className="pbl-card">
          <div className="pbl-table-wrapper">
            <table className="pbl-table">
              <thead>
                <tr>
                  <th>Bundle Item</th>
                  <th>Item Group</th>
                  <th>Selling Price</th>
                  <th>Included Components</th>
                  <th>Availability Status</th>
                  <th style={{ width: '48px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: '#0082f6' }} />
                      <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
                        Loading Product Bundles...
                      </p>
                    </td>
                  </tr>
                ) : bundles.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <Package size={40} style={{ margin: '0 auto 0.75rem', color: '#cbd5e1' }} />
                      <p style={{ fontSize: '0.9rem', fontWeight: 800, color: '#334155' }}>
                        No product bundles found
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        Try clearing filters or click "Create Product Bundle" to define a new one.
                      </p>
                    </td>
                  </tr>
                ) : (
                  bundles.map((bundle) => (
                    <tr 
                      key={bundle.name} 
                      onClick={() => { setSelectedBundle(bundle); setShowDetailModal(true); }} 
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Bundle Item */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{
                            width: '42px', height: '42px', borderRadius: '12px',
                            background: '#eff6ff', color: '#2563eb',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, fontWeight: 900
                          }}>
                            <Boxes size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.85rem' }}>
                              {bundle.item_name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 700, marginTop: '2px' }}>
                              {bundle.new_item_code}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Item Group */}
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>
                          {bundle.item_group || 'Standard Bundle'}
                        </span>
                      </td>

                      {/* Selling Price */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', fontWeight: 900, color: '#0f172a', fontSize: '0.9rem' }}>
                          <DirhamIcon className="w-4 h-4 mr-1 text-blue-600" />
                          <span>{bundle.selling_price?.toFixed(2)}</span>
                          {bundle.calculated_price && bundle.calculated_price !== bundle.selling_price && (
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textDecoration: 'line-through', marginLeft: '0.6rem', fontWeight: 600 }}>
                              AED {bundle.calculated_price?.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Included Component Items */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '360px' }}>
                          {(bundle.items || []).map((item, idx) => (
                            <div 
                              key={idx} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                gap: '0.6rem', 
                                background: '#f8fafc', 
                                padding: '5px 10px', 
                                borderRadius: '8px', 
                                border: '1px solid #f1f5f9' 
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 900, color: '#2563eb', fontSize: '0.78rem' }}>{item.qty}x</span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>{item.item_name || item.item_code}</span>
                              </div>
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '6px',
                                marginLeft: 'auto',
                                flexShrink: 0,
                                background: item.actual_qty > 0 ? '#eff6ff' : '#fef2f2',
                                color: item.actual_qty > 0 ? '#2563eb' : '#dc2626',
                                border: `1px solid ${item.actual_qty > 0 ? '#bfdbfe' : '#fecaca'}`
                              }}>
                                {item.actual_qty || 0} {item.uom}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Availability Status */}
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background: bundle.available_bundle_qty > 0 ? '#eff6ff' : '#fffbeb',
                          color: bundle.available_bundle_qty > 0 ? '#2563eb' : '#d97706',
                          border: `1px solid ${bundle.available_bundle_qty > 0 ? '#bfdbfe' : '#fde68a'}`
                        }}>
                          <CheckCircle2 size={12} />
                          {bundle.available_bundle_qty} sets available
                        </span>
                      </td>

                      {/* Controls / Actions Menu */}
                      <td style={{ position: 'relative', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdown(activeDropdown === bundle.name ? null : bundle.name);
                          }}
                          style={{
                            background: activeDropdown === bundle.name ? '#eff6ff' : 'none',
                            border: activeDropdown === bundle.name ? '1.5px solid #bfdbfe' : '1.5px solid transparent',
                            cursor: 'pointer',
                            padding: '0.4rem 0.5rem',
                            borderRadius: '8px',
                            color: activeDropdown === bundle.name ? '#0082f6' : '#64748b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          title="Actions"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {activeDropdown === bundle.name && (
                          <div
                            ref={dropdownRef}
                            style={{
                              position: 'absolute',
                              right: '1rem',
                              top: 'calc(100% - 8px)',
                              zIndex: 50,
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                              minWidth: '150px',
                              overflow: 'hidden',
                              padding: '4px'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdown(null);
                                setSelectedBundle(bundle);
                                setShowDetailModal(true);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#334155',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <Eye size={15} color="#475569" />
                              <span>View Details</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdown(null);
                                handleOpenEditModal(bundle);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#2563eb',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <Edit2 size={15} color="#2563eb" />
                              <span>Edit Bundle</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveDropdown(null);
                                handleDeleteBundle(bundle);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#ef4444',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              <Trash2 size={15} color="#ef4444" />
                              <span>Delete Bundle</span>
                            </button>
                          </div>
                        )}
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
        <React.Fragment>
          <div
            className="bundle-modal-overlay"
            onClick={() => setShowDetailModal(false)}
          />

          <div className="bundle-modal-wrapper">
            <div className="bundle-modal-box" role="dialog" aria-modal="true">
              {/* Header */}
              <header className="bundle-modal-header">
                <div>
                  <h2 className="bundle-modal-title">
                    {selectedBundle.item_name}
                  </h2>
                  <div className="bundle-modal-meta">
                    <span className="bundle-modal-code-badge">
                      {selectedBundle.new_item_code}
                    </span>
                    <span className="bundle-modal-count-text">
                      {(selectedBundle.items || []).length} Included Items
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close modal"
                  onClick={() => setShowDetailModal(false)}
                  className="bundle-modal-close-btn"
                >
                  <X style={{ width: '20px', height: '20px' }} />
                </button>
              </header>

              {/* Body */}
              <main className="bundle-modal-body">
                {/* Hero Pricing Card */}
                <div className="bundle-modal-hero-card">
                  <div className="bundle-modal-hero-decor" />
                  <div>
                    <h3 className="bundle-modal-hero-title">
                      Bundle Selling Price
                    </h3>
                    <p className="bundle-modal-hero-sub">
                      Calculated total rate
                    </p>
                  </div>
                  <div className="bundle-modal-hero-price">
                    AED {selectedBundle.selling_price?.toFixed(2)}
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <h3 className="bundle-modal-section-title">
                    Included Component Items
                  </h3>
                  <div>
                    {(selectedBundle.items || []).map((item, idx) => (
                      <div key={idx} className="bundle-modal-item-card">
                        <div className="bundle-modal-item-header">
                          <h4 className="bundle-modal-item-name">
                            {item.item_name || item.item_code}
                          </h4>
                          <span className="bundle-modal-item-price">
                            AED {(item.rate * item.qty).toFixed(2)}
                          </span>
                        </div>
                        <div className="bundle-modal-item-footer">
                          <div className="bundle-modal-qty-text">
                            <span>Quantity:</span>
                            <span className="bundle-modal-qty-val">{item.qty} {item.uom}</span>
                            <span style={{ color: '#94a3b8' }}>×</span>
                            <span>AED {item.rate}</span>
                          </div>
                          <div className="bundle-modal-stock-badge">
                            <span className="bundle-modal-stock-dot" />
                            Stock {item.actual_qty}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </main>

              {/* Footer */}
              <footer className="bundle-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="bundle-modal-close-action"
                >
                  Close
                </button>
              </footer>
            </div>
          </div>
        </React.Fragment>
      )}

      {/* ==================== QUICK CREATE PARENT ITEM MODAL ==================== */}
      {showQuickCreateParentModal && (
        <div className="pbl-modal-backdrop">
          <div className="pbl-modal-card">
            <div style={{ padding: '1.15rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>Quick Create Parent Item</h3>
                  <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, margin: '2px 0 0' }}>Non-Stock Combo Wrapper Item</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickCreateParentModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickCreateParent} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div style={{ padding: '0.85rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', display: 'flex', gap: '0.6rem', fontSize: '0.78rem', color: '#1e40af' }}>
                <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  This creates a <strong>Non-Stock Item</strong> (Maintain Stock = NO) specifically for this Product Bundle.
                </span>
              </div>

              <div className="pbl-field-group">
                <label className="pbl-filter-label">
                  Parent Item Code <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COMBO-RAMADAN-GIFT"
                  value={quickParentCode}
                  onChange={(e) => setQuickParentCode(e.target.value.toUpperCase())}
                  className="pbl-input"
                  style={{ fontFamily: 'monospace', fontWeight: 800 }}
                />
              </div>

              <div className="pbl-field-group">
                <label className="pbl-filter-label">
                  Item Name / Bundle Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramadan Special Gift Box"
                  value={quickParentName}
                  onChange={(e) => setQuickParentName(e.target.value)}
                  className="pbl-input"
                  style={{ fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="pbl-field-group">
                  <label className="pbl-filter-label">
                    Main Group <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <CustomSearchDropdown
                    placeholder="Select Main Group..."
                    value={quickParentMainGroup}
                    onSelect={(val) => {
                      const name = typeof val === 'string' ? val : (val?.name || val?.value || val?.label || '');
                      setQuickParentMainGroup(name);
                      setQuickParentSubGroup('');
                    }}
                    fetchData={async (query) => {
                      let mainList = [];
                      if (groupHierarchy && groupHierarchy.length > 0) {
                        mainList = groupHierarchy.map(h => h.main_group || h.name).filter(Boolean);
                      }
                      if (mainList.length === 0) {
                        mainList = ['Stationery Products', 'Products', 'All Item Groups'];
                      }
                      const filtered = query ? mainList.filter(m => m.toLowerCase().includes(query.toLowerCase())) : mainList;
                      return filtered.map(m => ({ name: m, label: m }));
                    }}
                    optionsLabel="label"
                    themeColor={themeColor}
                  />
                </div>

                <div className="pbl-field-group">
                  <label className="pbl-filter-label">Subgroup</label>
                  <CustomSearchDropdown
                    placeholder={quickParentMainGroup ? "Select Subgroup..." : "Choose Main Group first"}
                    disabled={!quickParentMainGroup}
                    value={quickParentSubGroup}
                    onSelect={(val) => {
                      const name = typeof val === 'string' ? val : (val?.name || val?.value || val?.label || '');
                      setQuickParentSubGroup(name);
                    }}
                    fetchData={async (query) => {
                      if (!quickParentMainGroup) return [];
                      const match = (groupHierarchy || []).find(h => (h.main_group || h.name) === quickParentMainGroup);
                      let subList = [];
                      if (match && Array.isArray(match.subgroups)) {
                        subList = match.subgroups.map(s => (typeof s === 'string' ? s : (s.name || s.item_group_name || s.label))).filter(Boolean);
                      }
                      if (subList.length === 0) {
                        try {
                          const res = await frappeCall({
                            method: 'custom_retailpos.custom_retailpos.retail_api.retail.get_item_groups',
                            args: { search: query || '' },
                            type: 'GET'
                          });
                          const raw = res?.data || res || [];
                          subList = (Array.isArray(raw) ? raw : []).map(g => g.value || g.name || g.item_group_name || g.label || g);
                        } catch {
                          subList = [];
                        }
                      }
                      const filtered = query ? subList.filter(s => s.toLowerCase().includes(query.toLowerCase())) : subList;
                      return filtered.map(s => ({ name: s, label: s }));
                    }}
                    optionsLabel="label"
                    themeColor={themeColor}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setShowQuickCreateParentModal(false)}
                  className="pbl-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickCreatingParent}
                  className="pbl-btn-primary"
                >
                  {quickCreatingParent ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      <Save size={15} /> Create Parent Item
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductBundleList;
