import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  X,
  Plus,
  Package,
  Check,
  ChevronDown,
  Building2,
  Loader2,
  Sparkles
} from 'lucide-react';
import Swal from 'sweetalert2';

const QuickItemCreateModal = ({
  isOpen,
  onClose,
  onItemCreated,
  initialItemCode = '',
  initialItemName = '',
  warehouse = ''
}) => {
  // Form State
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemGroup, setItemGroup] = useState('Stationery Products');
  const [subgroup, setSubgroup] = useState('');
  const [stockUom, setStockUom] = useState('Nos');
  const [piecesPerBox, setPiecesPerBox] = useState(1);

  // Data & Hierarchy Lists
  const [itemGroups, setItemGroups] = useState([]);
  const [groupHierarchy, setGroupHierarchy] = useState([]);
  const [subgroups, setSubgroups] = useState([]);
  const [allUoms, setAllUoms] = useState([]);

  // UOM Filter Setting from Settings.jsx / LocalStorage
  const [filterPackingUomsOnly, setFilterPackingUomsOnly] = useState(() => {
    const saved = localStorage.getItem('uom_filter_packing_only');
    return saved !== null ? saved === 'true' : true;
  });

  // Dropdown Open/Search States
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [showSubgroupDropdown, setShowSubgroupDropdown] = useState(false);
  const [subgroupSearch, setSubgroupSearch] = useState('');

  // UI Status
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // DOM Refs
  const groupRef = useRef(null);
  const subgroupRef = useRef(null);
  const itemCodeInputRef = useRef(null);

  // Sync UOM setting changes from Settings page
  useEffect(() => {
    const handleUomSettingChanged = () => {
      const saved = localStorage.getItem('uom_filter_packing_only');
      setFilterPackingUomsOnly(saved !== null ? saved === 'true' : true);
    };
    window.addEventListener('uom_setting_changed', handleUomSettingChanged);
    return () => window.removeEventListener('uom_setting_changed', handleUomSettingChanged);
  }, []);

  // Packing UOM detection helper
  const isPackingUom = (uomValue) => {
    if (!uomValue) return false;
    const val = String(uomValue).trim().toLowerCase();
    const packingKeywords = [
      'nos', 'no', 'box', 'boxes', 'pcs', 'piece', 'pieces', 'pkt', 'packet', 'packets',
      'ctn', 'carton', 'cartons', 'doz', 'dozen', 'set', 'sets', 'pack', 'packs',
      'pair', 'pairs', 'bag', 'bags', 'bundle', 'bundles', 'roll', 'rolls',
      'bottle', 'bottles', 'can', 'cans', 'jar', 'jars', 'tin', 'tins', 'strip', 'strips',
      'unit', 'units', 'case', 'cases', 'crate', 'crates', 'bale', 'bales'
    ];
    return packingKeywords.some(k => val === k || val === `${k}.` || val.startsWith(`${k} `) || val.endsWith(` ${k}`));
  };

  // Filtered UOM list based on active setting
  const availableUoms = useMemo(() => {
    const defaultPackingList = ['Nos', 'Box', 'Pcs', 'Pkt', 'Carton', 'Set', 'Pack', 'Dozen', 'Pair', 'Roll', 'Kg', 'Meter'];
    let sourceList = allUoms.length > 0 ? allUoms : defaultPackingList;

    if (filterPackingUomsOnly) {
      sourceList = sourceList.filter(u => isPackingUom(u) || u === stockUom);
      if (sourceList.length === 0) sourceList = defaultPackingList;
    }

    return Array.from(new Set(sourceList));
  }, [allUoms, filterPackingUomsOnly, stockUom]);

  // Load initial data and hierarchy on modal open
  useEffect(() => {
    if (isOpen) {
      const code = initialItemCode || '';
      const name = initialItemName || initialItemCode || '';
      setItemCode(code);
      setItemName(name);
      setPiecesPerBox(1);
      setStockUom('Nos');
      setSubgroup('');
      setSubgroupSearch('');
      setShowGroupDropdown(false);
      setShowSubgroupDropdown(false);

      setTimeout(() => {
        if (itemCodeInputRef.current) itemCodeInputRef.current.focus();
      }, 80);

      setLoading(true);

      // Fetch hierarchy and whitelisted UOMs in parallel
      Promise.all([
        axios.get('/api/method/custom_retailpos.custom_pos_features.get_item_group_hierarchy', { withCredentials: true })
          .then(res => res.data?.message?.hierarchy || [])
          .catch(() => []),
        axios.get('/api/method/kyle_retail.retail_api.api.get_uoms_retail', { withCredentials: true })
          .then(res => {
            const list = res.data?.message?.data || res.data?.data || [];
            return list.map(u => (typeof u === 'string' ? u : (u.name || u.uom_name || ''))).filter(Boolean);
          })
          .catch(() => ['Nos', 'Box', 'Pcs', 'Pkt', 'Carton', 'Set', 'Pack', 'Dozen', 'Pair', 'Roll', 'Kg'])
      ]).then(([hierarchy, uomList]) => {
        setGroupHierarchy(hierarchy);
        setAllUoms(Array.isArray(uomList) && uomList.length > 0 ? uomList : ['Nos', 'Box', 'Pcs', 'Pkt', 'Carton', 'Set', 'Pack', 'Dozen', 'Pair', 'Roll', 'Kg']);

        let mainGroupsList = [];
        if (Array.isArray(hierarchy) && hierarchy.length > 0) {
          mainGroupsList = hierarchy.map(h => h.main_group).filter(Boolean);
        }
        if (mainGroupsList.length === 0) {
          mainGroupsList = ['Stationery Products', 'Products', 'All Item Groups'];
        }

        setItemGroups(mainGroupsList);

        const initialGroup = mainGroupsList.includes('Stationery Products')
          ? 'Stationery Products'
          : (mainGroupsList.includes('Products') ? 'Products' : mainGroupsList[0]);

        setItemGroup(initialGroup);
        setGroupSearch(initialGroup);
        resolveSubgroupsForGroup(initialGroup, hierarchy);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen, initialItemCode, initialItemName]);

  // Resolve Subgroups for selected Main Group
  const resolveSubgroupsForGroup = async (groupName, currentHierarchy = groupHierarchy) => {
    let directSubgroups = [];

    if (Array.isArray(currentHierarchy) && currentHierarchy.length > 0) {
      const match = currentHierarchy.find(h => h.main_group === groupName);
      if (match && Array.isArray(match.subgroups)) {
        directSubgroups = [...match.subgroups];
      }
    }

    try {
      const url = groupName
        ? `/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_subgroups?item_group=${encodeURIComponent(groupName)}`
        : '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.get_item_subgroups';
      const res = await axios.get(url, { withCredentials: true });
      const apiList = res.data?.message || [];
      const apiNames = (Array.isArray(apiList) ? apiList : [])
        .map(s => (typeof s === 'string' ? s : (s.subgroup_name || s.name || '')))
        .filter(Boolean);

      apiNames.forEach(name => {
        if (!directSubgroups.includes(name)) {
          directSubgroups.push(name);
        }
      });
    } catch {
      // ignore
    }

    setSubgroups(directSubgroups);
  };

  const handleSelectGroup = (group) => {
    setItemGroup(group);
    setGroupSearch(group);
    setShowGroupDropdown(false);
    setSubgroup('');
    setSubgroupSearch('');
    resolveSubgroupsForGroup(group);
  };

  const handleSelectSubgroup = (sub) => {
    setSubgroup(sub);
    setSubgroupSearch(sub);
    setShowSubgroupDropdown(false);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (groupRef.current && !groupRef.current.contains(e.target)) setShowGroupDropdown(false);
      if (subgroupRef.current && !subgroupRef.current.contains(e.target)) setShowSubgroupDropdown(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (showGroupDropdown || showSubgroupDropdown) {
          setShowGroupDropdown(false);
          setShowSubgroupDropdown(false);
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, showGroupDropdown, showSubgroupDropdown]);

  if (!isOpen) return null;

  // Search filtering
  const filteredGroups = itemGroups.filter(g =>
    g.toLowerCase().includes((groupSearch || '').toLowerCase().trim())
  );

  const filteredSubgroups = subgroups.filter(s =>
    s.toLowerCase().includes((subgroupSearch || '').toLowerCase().trim())
  );

  // Form submission
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!itemCode.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Item Code Required',
        text: 'Please enter a valid Item Code or SKU.',
        confirmButtonColor: '#059669'
      });
      return;
    }

    setSubmitting(true);
    try {
      const activeWarehouse = warehouse || localStorage.getItem('warehouse') || '';
      const finalGroupName = subgroup || itemGroup || groupSearch.trim() || 'Products';
      const finalSubgroupName = subgroup || subgroupSearch.trim() || undefined;

      const res = await axios.post(
        '/api/method/custom_retailpos.custom_retailpos.retail_api.retail.create_quick_item_retail',
        {
          item_code: itemCode.trim(),
          item_name: (itemName || itemCode).trim(),
          item_group: finalGroupName,
          subgroup: finalSubgroupName,
          stock_uom: stockUom || 'Nos',
          pieces_per_box: parseFloat(piecesPerBox) || 1,
          warehouse: activeWarehouse
        },
        { withCredentials: true }
      );

      if (res.data?.message?.status === 'success' || res.data?.message?.data) {
        const createdData = res.data.message.data || {
          name: itemCode.trim(),
          item_code: itemCode.trim(),
          item_name: (itemName || itemCode).trim(),
          item_group: finalGroupName,
          stock_uom: stockUom,
          custom_pieces_per_box: parseFloat(piecesPerBox) || 1
        };

        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
        Toast.fire({
          icon: 'success',
          title: `Item "${createdData.item_code}" Created & Selected!`
        });

        if (onItemCreated) onItemCreated(createdData);
        onClose();
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Creation Failed',
          text: res.data?.message?.message || 'Could not create item in catalog',
          confirmButtonColor: '#059669'
        });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || err.message || 'Failed to create item',
        confirmButtonColor: '#059669'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const currentWh = warehouse || localStorage.getItem('warehouse') || 'Current Branch';
  const branchDisplayName = currentWh.split(' - ')[0];

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        overflow: 'hidden'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1000000
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* HEADER                                                                    */}
        {/* ========================================================================= */}
        <div
          style={{
            padding: '20px 28px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                border: '1px solid #d1fae5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Package size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                  Register New Item
                </h2>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: '#ecfdf5',
                    color: '#047857',
                    border: '1px solid #a7f3d0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    flexShrink: 0
                  }}
                >
                  <Sparkles size={10} /> Fast Setup
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0 0', fontWeight: 400 }}>
                Create a catalog item and link it to the current branch
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#334155'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
            title="Press ESC to close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* FORM CONTENT (With generous 28px padding and 16px field spacing)          */}
        {/* ========================================================================= */}
        <form
          id="quick-item-create-form"
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            backgroundColor: '#ffffff'
          }}
        >
          {/* ------------------------------------------------------------------------- */}
          {/* SECTION 1: BASIC INFORMATION                                              */}
          {/* ------------------------------------------------------------------------- */}
          <div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                Basic Information
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {/* Item Code / SKU */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Item Code / SKU <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  ref={itemCodeInputRef}
                  type="text"
                  required
                  value={itemCode}
                  onChange={e => setItemCode(e.target.value)}
                  placeholder="e.g. 968978"
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0f172a',
                    outline: 'none',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease'
                  }}
                  onFocus={e => { e.target.style.borderColor = '#059669'; e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Item Name */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Item Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="e.g. A4 Copy Paper 80GSM"
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease'
                  }}
                  onFocus={e => { e.target.style.borderColor = '#059669'; e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------------- */}
          {/* SECTION 2: CLASSIFICATION                                                 */}
          {/* ------------------------------------------------------------------------- */}
          <div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                Classification
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {/* Item Group */}
              <div style={{ position: 'relative' }} ref={groupRef}>
                <div style={{ marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Item Group
                  </label>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={showGroupDropdown ? groupSearch : itemGroup}
                    onChange={e => {
                      setGroupSearch(e.target.value);
                      setShowGroupDropdown(true);
                    }}
                    onFocus={() => {
                      setGroupSearch('');
                      setShowGroupDropdown(true);
                    }}
                    placeholder="Search Item Group..."
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 38px 0 14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#0f172a',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease'
                    }}
                    onFocusCapture={e => { e.target.style.borderColor = '#059669'; e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)'; }}
                    onBlurCapture={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroupDropdown(prev => !prev)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Dropdown Menu */}
                {showGroupDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '100%',
                      marginTop: '4px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12)',
                      zIndex: 50,
                      maxHeight: '190px',
                      overflowY: 'auto',
                      padding: '4px 0'
                    }}
                  >
                    {loading ? (
                      <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Loader2 size={13} className="animate-spin" /> Loading...
                      </div>
                    ) : filteredGroups.length > 0 ? (
                      filteredGroups.map(g => {
                        const isSelected = itemGroup === g;
                        return (
                          <div
                            key={g}
                            onClick={() => handleSelectGroup(g)}
                            style={{
                              padding: '9px 14px',
                              fontSize: '13px',
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#047857' : '#334155',
                              backgroundColor: isSelected ? '#ecfdf5' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g}</span>
                            {isSelected && <Check size={14} color="#059669" />}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ padding: '12px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>No match found</p>
                        <button
                          type="button"
                          onClick={() => handleSelectGroup(groupSearch.trim())}
                          style={{ marginTop: '4px', background: 'none', border: 'none', color: '#059669', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          + Use "{groupSearch.trim()}"
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Subgroup */}
              <div style={{ position: 'relative' }} ref={subgroupRef}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Subgroup <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  {subgroups.length > 0 && (
                    <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>
                      {subgroups.length} available
                    </span>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={showSubgroupDropdown ? subgroupSearch : subgroup}
                    onChange={e => {
                      setSubgroupSearch(e.target.value);
                      setSubgroup(e.target.value);
                      setShowSubgroupDropdown(true);
                    }}
                    onFocus={() => {
                      setSubgroupSearch('');
                      setShowSubgroupDropdown(true);
                    }}
                    placeholder={subgroups.length > 0 ? "Select subgroup..." : "Enter subgroup..."}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 38px 0 14px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#0f172a',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease'
                    }}
                    onFocusCapture={e => { e.target.style.borderColor = '#059669'; e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)'; }}
                    onBlurCapture={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSubgroupDropdown(prev => !prev)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>

                {/* Subgroup Dropdown Menu */}
                {showSubgroupDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '100%',
                      marginTop: '4px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12)',
                      zIndex: 50,
                      maxHeight: '190px',
                      overflowY: 'auto',
                      padding: '4px 0'
                    }}
                  >
                    {filteredSubgroups.length > 0 ? (
                      filteredSubgroups.map(s => {
                        const isSelected = subgroup === s;
                        return (
                          <div
                            key={s}
                            onClick={() => handleSelectSubgroup(s)}
                            style={{
                              padding: '9px 14px',
                              fontSize: '13px',
                              fontWeight: isSelected ? 700 : 500,
                              color: isSelected ? '#047857' : '#334155',
                              backgroundColor: isSelected ? '#ecfdf5' : 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
                            {isSelected && <Check size={14} color="#059669" />}
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ padding: '12px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                          {subgroups.length === 0 ? `No linked subgroups for ${itemGroup}` : `No match for "${subgroupSearch}"`}
                        </p>
                        {subgroupSearch.trim() && (
                          <button
                            type="button"
                            onClick={() => handleSelectSubgroup(subgroupSearch.trim())}
                            style={{ marginTop: '4px', background: 'none', border: 'none', color: '#059669', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            + Use Custom "{subgroupSearch.trim()}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------------- */}
          {/* SECTION 3: PACKAGING & UNITS                                              */}
          {/* ------------------------------------------------------------------------- */}
          <div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                Packaging & Units
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {/* Base UOM */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Base UOM
                  </label>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>
                    {filterPackingUomsOnly ? 'Packing UOMs' : 'All UOMs'}
                  </span>
                </div>

                <select
                  value={stockUom}
                  onChange={e => setStockUom(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#0f172a',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease'
                  }}
                  onFocus={e => { e.target.style.borderColor = '#059669'; e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)'; }}
                  onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                >
                  {availableUoms.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Pieces Per Box */}
              <div>
                <div style={{ marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                    Pieces Per Box <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(Nos / Box)</span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '42px' }}>
                  <button
                    type="button"
                    onClick={() => setPiecesPerBox(prev => Math.max(1, (parseFloat(prev) || 1) - 1))}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      fontWeight: 700,
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  >
                    −
                  </button>

                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={piecesPerBox}
                    onChange={e => setPiecesPerBox(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '42px',
                      textAlign: 'center',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease'
                    }}
                    onFocus={e => { e.target.style.borderColor = '#059669'; e.target.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.12)'; }}
                    onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                  />

                  <button
                    type="button"
                    onClick={() => setPiecesPerBox(prev => (parseFloat(prev) || 0) + 1)}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      fontWeight: 700,
                      fontSize: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------------- */}
          {/* BRANCH WAREHOUSE STATUS CARD                                              */}
          {/* ------------------------------------------------------------------------- */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #d1fae5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Building2 size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8' }}>
                  Branch Warehouse
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {branchDisplayName}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#047857',
                fontSize: '11px',
                fontWeight: 600,
                flexShrink: 0,
                marginLeft: '12px'
              }}
            >
              <Check size={13} strokeWidth={2.5} />
              <span>Linked</span>
            </div>
          </div>
        </form>

        {/* ========================================================================= */}
        {/* FOOTER                                                                    */}
        {/* ========================================================================= */}
        <div
          style={{
            padding: '16px 28px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '12px' }}>
            <span>Press</span>
            <span style={{ padding: '2px 6px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '10px', fontWeight: 700, color: '#475569', fontFamily: 'monospace' }}>
              ESC
            </span>
            <span>to close</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                height: '40px',
                padding: '0 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#64748b',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="quick-item-create-form"
              disabled={submitting || !itemCode.trim()}
              style={{
                height: '40px',
                padding: '0 20px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: (submitting || !itemCode.trim()) ? '#94a3b8' : '#059669',
                border: 'none',
                borderRadius: '8px',
                cursor: (submitting || !itemCode.trim()) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { if (!submitting && itemCode.trim()) e.currentTarget.style.backgroundColor = '#047857'; }}
              onMouseLeave={e => { if (!submitting && itemCode.trim()) e.currentTarget.style.backgroundColor = '#059669'; }}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Creating Item...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Create & Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuickItemCreateModal;
