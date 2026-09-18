import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { 
  Search, 
  X, 
  Filter, 
  SlidersHorizontal, 
  Package, 
  Barcode, 
  Tag, 
  Layers, 
  Check, 
  Plus, 
  ArrowUpDown, 
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Info,
  Maximize2,
  Minimize2,
  LayoutList,
  Rows3,
  ChevronDown,
  LayoutGrid,
  CheckCircle2
} from 'lucide-react';
import DirhamIcon from '../../assets/Currency/DirhamIcon';

// Reusable Searchable Dropdown
function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  allLabel = 'All',
  placeholder = 'Search...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options;
    return options.filter(opt => {
      const text = typeof opt === 'object' ? opt.label || opt.value : opt;
      return String(text).toLowerCase().includes(q);
    });
  }, [options, search]);

  const displayLabel = useMemo(() => {
    if (value === 'all' || !value) return allLabel;
    const found = options.find(opt => (typeof opt === 'object' ? opt.value === value : opt === value));
    if (found) return typeof found === 'object' ? found.label : found;
    return value;
  }, [value, options, allLabel]);

  const isCustomSelected = value && value !== 'all';

  return (
    <div className="relative w-full" ref={dropdownRef} style={{ textAlign: 'left' }}>
      {label && (
        <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>
          {label}
        </span>
      )}
      
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        style={{
          width: '100%',
          height: '34px',
          padding: '0 10px',
          backgroundColor: isCustomSelected ? '#eef2ff' : '#ffffff',
          border: `1.5px solid ${isCustomSelected ? '#6366f1' : '#cbd5e1'}`,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box'
        }}
      >
        <span style={{ fontSize: '11.5px', fontWeight: isCustomSelected ? 800 : 600, color: isCustomSelected ? '#4338ca' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '4px' }}>
          {displayLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {options.length > 0 && (
            <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', backgroundColor: isCustomSelected ? '#e0e7ff' : '#f1f5f9', color: isCustomSelected ? '#4338ca' : '#64748b' }}>
              {options.length}
            </span>
          )}
          <ChevronDown size={12} color={isCustomSelected ? '#6366f1' : '#94a3b8'} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </div>
      </button>

      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 10000000,
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
            overflow: 'hidden'
          }}
        >
          {/* Search box inside dropdown */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={12} color="#94a3b8" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%',
                fontSize: '11px',
                fontWeight: 600,
                color: '#0f172a',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: '2px 0'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#94a3b8' }}
              >
                <X size={10} />
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px' }}>
            <button
              type="button"
              onClick={() => {
                onChange('all');
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: 'none',
                textAlign: 'left',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: (value === 'all' || !value) ? '#6366f1' : 'transparent',
                color: (value === 'all' || !value) ? '#ffffff' : '#334155'
              }}
            >
              <span>{allLabel}</span>
              {(value === 'all' || !value) && <Check size={12} strokeWidth={3} />}
            </button>

            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                No options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const optVal = typeof opt === 'object' ? opt.value : opt;
                const optLabel = typeof opt === 'object' ? opt.label : opt;
                const isSelected = value === optVal;

                return (
                  <button
                    key={optVal}
                    type="button"
                    onClick={() => {
                      onChange(optVal);
                      setIsOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? '#6366f1' : 'transparent',
                      color: isSelected ? '#ffffff' : '#1e293b'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{optLabel}</span>
                    {isSelected && <Check size={12} strokeWidth={3} style={{ flexShrink: 0, marginLeft: '4px' }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ItemSearchFilterDrawer({
  isOpen,
  onClose,
  items = [],
  onSelectItem,
  warehouse = '',
  categories = [],
  theme = 'modern'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedSize, setSelectedSize] = useState('all');
  const [stockFilter, setStockFilter] = useState('all'); // all, in_stock, out_of_stock
  const [sortBy, setSortBy] = useState('default');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [addedItemCode, setAddedItemCode] = useState(null);

  // Size option presets: 'compact' (540px), 'normal' (720px), 'wide' (920px), 'full' (98vw)
  const [modalSize, setModalSize] = useState(() => {
    try {
      return localStorage.getItem('pos_item_filter_modal_size') || 'normal';
    } catch {
      return 'normal';
    }
  });

  // Display density: 'compact' (compact dense rows) vs 'standard' (full cards)
  const [rowDensity, setRowDensity] = useState(() => {
    try {
      return localStorage.getItem('pos_item_filter_density') || 'compact';
    } catch {
      return 'compact';
    }
  });

  const searchInputRef = useRef(null);
  const listContainerRef = useRef(null);

  const handleSetModalSize = (size) => {
    setModalSize(size);
    try {
      localStorage.setItem('pos_item_filter_modal_size', size);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSetRowDensity = (density) => {
    setRowDensity(density);
    try {
      localStorage.setItem('pos_item_filter_density', density);
    } catch (e) {
      console.warn(e);
    }
  };

  // Focus search input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract unique brands
  const brandOptions = useMemo(() => {
    const brandsSet = new Set();
    items.forEach(it => {
      if (it.brand && typeof it.brand === 'string' && it.brand.trim()) {
        brandsSet.add(it.brand.trim());
      }
    });
    return Array.from(brandsSet).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Extract unique sizes
  const sizeOptions = useMemo(() => {
    const sizeSet = new Set();
    items.forEach(it => {
      const sz = it.custom_size || it.size;
      if (sz && typeof sz === 'string' && sz.trim()) {
        sizeSet.add(sz.trim());
      }
    });
    return Array.from(sizeSet).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Extract unique categories
  const categoryOptions = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.filter(c => c !== 'all');
    }
    const catSet = new Set();
    items.forEach(it => {
      const cat = it.category || it.item_group;
      if (cat && typeof cat === 'string' && cat.trim()) {
        catSet.add(cat.trim());
      }
    });
    return Array.from(catSet).sort((a, b) => a.localeCompare(b));
  }, [categories, items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];

    const query = searchQuery.trim().toLowerCase();

    return items.filter(item => {
      // 1. Stock filter
      const qty = parseFloat(item.local_qty ?? item.actual_qty ?? 0) || 0;
      if (stockFilter === 'in_stock' && qty <= 0) return false;
      if (stockFilter === 'out_of_stock' && qty > 0) return false;

      // 2. Category filter
      if (selectedCategory !== 'all') {
        const itemCat = (item.category || item.item_group || '').toLowerCase();
        if (itemCat !== selectedCategory.toLowerCase()) return false;
      }

      // 3. Brand filter
      if (selectedBrand !== 'all') {
        const itemBrand = (item.brand || '').toLowerCase();
        if (itemBrand !== selectedBrand.toLowerCase()) return false;
      }

      // 4. Size filter
      if (selectedSize !== 'all') {
        const itemSize = (item.custom_size || item.size || '').toLowerCase();
        if (itemSize !== selectedSize.toLowerCase()) return false;
      }

      // 5. Search query filter
      if (!query) return true;

      const code = (item.id || item.item_code || '').toLowerCase();
      const name = (item.name || item.item_name || '').toLowerCase();
      const brand = (item.brand || '').toLowerCase();
      const size = (item.custom_size || item.size || '').toLowerCase();
      const cat = (item.category || item.item_group || '').toLowerCase();
      
      const barcodes = Array.isArray(item.barcodes) 
        ? item.barcodes.map(b => (b.barcode || b).toLowerCase()).join(' ') 
        : (item.barcode || '').toLowerCase();

      switch (searchField) {
        case 'item_code':
          return code.includes(query);
        case 'item_name':
          return name.includes(query);
        case 'barcode':
          return barcodes.includes(query) || code.includes(query);
        case 'size':
          return size.includes(query);
        case 'brand':
          return brand.includes(query);
        case 'category':
          return cat.includes(query);
        case 'all':
        default:
          return (
            code.includes(query) ||
            name.includes(query) ||
            barcodes.includes(query) ||
            size.includes(query) ||
            brand.includes(query) ||
            cat.includes(query)
          );
      }
    }).sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'price_asc') {
        return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
      }
      if (sortBy === 'price_desc') {
        return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
      }
      if (sortBy === 'stock_desc') {
        return (parseFloat(b.local_qty ?? b.actual_qty ?? 0)) - (parseFloat(a.local_qty ?? a.actual_qty ?? 0));
      }
      return 0;
    });
  }, [items, searchQuery, searchField, selectedCategory, selectedBrand, selectedSize, stockFilter, sortBy]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  const handleKeyDown = (e) => {
    if (filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
      scrollRowIntoView(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      scrollRowIntoView(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentItem = filteredItems[selectedIndex];
      if (currentItem) {
        handleAddItem(currentItem);
      }
    }
  };

  const scrollRowIntoView = (idx) => {
    if (!listContainerRef.current) return;
    const rows = listContainerRef.current.querySelectorAll('.drawer-item-row');
    if (rows[idx]) {
      rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  const handleAddItem = (item) => {
    if (onSelectItem) {
      onSelectItem(item);
    }
    setAddedItemCode(item.id || item.item_code);
    setTimeout(() => {
      setAddedItemCode(null);
    }, 1200);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSearchField('all');
    setSelectedCategory('all');
    setSelectedBrand('all');
    setSelectedSize('all');
    setStockFilter('all');
    setSortBy('default');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const isFilterActive = searchQuery || searchField !== 'all' || selectedCategory !== 'all' || selectedBrand !== 'all' || selectedSize !== 'all' || stockFilter !== 'all' || sortBy !== 'default';

  if (!isOpen) return null;

  // Modal width mapping
  const getModalWidth = () => {
    switch (modalSize) {
      case 'compact':
        return '540px';
      case 'wide':
        return '940px';
      case 'full':
        return '98vw';
      case 'normal':
      default:
        return '740px';
    }
  };

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999999,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#f8fafc',
          width: '100%',
          maxWidth: getModalWidth(),
          maxHeight: '92vh',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          textAlign: 'left',
          transition: 'max-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Modal Header */}
        <div 
          style={{
            padding: '14px 20px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#eef2ff',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <SlidersHorizontal size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Filter & Search Items
                </h3>
                <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', textTransform: 'uppercase' }}>
                  POS
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', fontWeight: 600, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {warehouse ? `Warehouse: ${warehouse}` : 'Quick multi-attribute search across catalogue & stock'}
              </p>
            </div>
          </div>

          {/* Sizing & Density Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Size Selector Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {[
                { key: 'compact', label: 'S', title: 'Compact (540px)' },
                { key: 'normal', label: 'M', title: 'Standard (740px)' },
                { key: 'wide', label: 'L', title: 'Wide (940px)' },
                { key: 'full', label: 'Full', title: 'Full Screen' }
              ].map(sz => (
                <button
                  key={sz.key}
                  type="button"
                  onClick={() => handleSetModalSize(sz.key)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: modalSize === sz.key ? '#ffffff' : 'transparent',
                    color: modalSize === sz.key ? '#6366f1' : '#64748b',
                    boxShadow: modalSize === sz.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s'
                  }}
                  title={sz.title}
                >
                  {sz.label}
                </button>
              ))}
            </div>

            {/* Density switch */}
            <button
              type="button"
              onClick={() => handleSetRowDensity(rowDensity === 'compact' ? 'standard' : 'compact')}
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: rowDensity === 'compact' ? '#eef2ff' : '#ffffff',
                color: rowDensity === 'compact' ? '#6366f1' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 700
              }}
              title={rowDensity === 'compact' ? "Switch to Detailed Cards" : "Switch to Compact Dense Rows"}
            >
              {rowDensity === 'compact' ? <Rows3 size={14} /> : <LayoutList size={14} />}
              <span>{rowDensity === 'compact' ? 'Compact' : 'Detailed'}</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              title="Close (ESC)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Controls Box */}
        <div 
          style={{
            padding: '14px 20px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flexShrink: 0
          }}
        >
          {/* Primary Search Bar */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '10px',
              overflow: 'hidden'
            }}
          >
            {/* Search target selector */}
            <div style={{ position: 'relative', borderRight: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', flexShrink: 0 }}>
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                style={{
                  height: '38px',
                  paddingLeft: '10px',
                  paddingRight: '24px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#334155',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none'
                }}
              >
                <option value="all">All Fields</option>
                <option value="item_code">Item Code</option>
                <option value="item_name">Item Name</option>
                <option value="barcode">Barcode</option>
                <option value="size">Size</option>
                <option value="brand">Brand</option>
                <option value="category">Category</option>
              </select>
              <ChevronDown size={11} color="#64748b" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>

            {/* Input */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 12px' }}>
              <Search size={15} color="#94a3b8" style={{ marginRight: '8px', flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  searchField === 'size' ? 'Filter by size (XL, 500g, 42)...' :
                  searchField === 'brand' ? 'Filter by brand...' :
                  searchField === 'barcode' ? 'Scan or enter barcode...' :
                  searchField === 'item_code' ? 'Enter Item Code / SKU...' :
                  'Search code, name, size, barcode, brand...'
                }
                style={{
                  width: '100%',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#0f172a',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  padding: '8px 0'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Secondary Searchable Dropdowns: Category, Brand, Size */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <SearchableSelect
              label="Category"
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categoryOptions}
              allLabel="All Categories"
              placeholder="Search category..."
            />

            <SearchableSelect
              label="Brand"
              value={selectedBrand}
              onChange={setSelectedBrand}
              options={brandOptions}
              allLabel="All Brands"
              placeholder="Search brand..."
            />

            <SearchableSelect
              label="Size"
              value={selectedSize}
              onChange={setSelectedSize}
              options={sizeOptions}
              allLabel="All Sizes"
              placeholder="Search size..."
            />
          </div>

          {/* Tertiary Row: Stock Buttons & Sort */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '2px' }}>
            {/* Stock Pills */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: stockFilter === 'all' ? '#ffffff' : 'transparent',
                  color: stockFilter === 'all' ? '#0f172a' : '#64748b',
                  boxShadow: stockFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                All Stock
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('in_stock')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: stockFilter === 'in_stock' ? '#10b981' : 'transparent',
                  color: stockFilter === 'in_stock' ? '#ffffff' : '#059669',
                  boxShadow: stockFilter === 'in_stock' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stockFilter === 'in_stock' ? '#ffffff' : '#10b981' }} />
                In Stock
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('out_of_stock')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: stockFilter === 'out_of_stock' ? '#ef4444' : 'transparent',
                  color: stockFilter === 'out_of_stock' ? '#ffffff' : '#dc2626',
                  boxShadow: stockFilter === 'out_of_stock' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stockFilter === 'out_of_stock' ? '#ffffff' : '#ef4444' }} />
                Out of Stock
              </button>
            </div>

            {/* Sort & Reset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <div style={{ position: 'relative' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    height: '30px',
                    paddingLeft: '8px',
                    paddingRight: '22px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#334155',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    appearance: 'none'
                  }}
                >
                  <option value="default">Sort: Default</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="stock_desc">Stock: High → Low</option>
                </select>
                <ChevronDown size={10} color="#64748b" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>

              {isFilterActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    height: '30px',
                    padding: '0 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#e11d48',
                    backgroundColor: '#ffe4e6',
                    border: '1px solid #fecdd3',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                  title="Clear all filters"
                >
                  <RotateCcw size={11} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info Bar */}
        <div 
          style={{
            padding: '6px 20px',
            backgroundColor: '#f1f5f9',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: 700,
            color: '#64748b',
            flexShrink: 0
          }}
        >
          <div>
            <span style={{ color: '#0f172a', fontWeight: 900 }}>{filteredItems.length}</span> items found
          </div>
          <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600 }}>
            Use ↑ ↓ arrows & Enter to add to cart
          </span>
        </div>

        {/* Results List */}
        <div 
          ref={listContainerRef} 
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: rowDensity === 'compact' ? '6px' : '8px'
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Package size={40} strokeWidth={1.2} color="#cbd5e1" />
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                No matching items found
              </p>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8' }}>
                Try adjusting search keywords or clearing active filters
              </p>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  style={{
                    marginTop: '8px',
                    padding: '6px 14px',
                    backgroundColor: '#eef2ff',
                    color: '#6366f1',
                    border: '1px solid #c7d2fe',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = selectedIndex === idx;
              const isJustAdded = addedItemCode === (item.id || item.item_code);
              const qty = parseFloat(item.local_qty ?? item.actual_qty ?? 0) || 0;
              const inStock = qty > 0;
              const size = item.custom_size || item.size;
              const barcode = item.barcodes?.[0]?.barcode || item.barcode;
              const price = parseFloat(item.price || item.standard_rate || 0).toFixed(2);

              if (rowDensity === 'compact') {
                return (
                  <div
                    key={item.id || item.item_code || idx}
                    className="drawer-item-row"
                    onClick={() => handleAddItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      borderRadius: '10px',
                      border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                      backgroundColor: isSelected ? '#f5f3ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      gap: '12px'
                    }}
                  >
                    {/* Item Code + Name + Size */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 800, color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                        {item.id || item.item_code}
                      </span>
                      
                      <span style={{ fontSize: '12.5px', fontWeight: 800, color: isSelected ? '#4338ca' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {item.name || item.item_name}
                      </span>

                      {size && (
                        <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#6366f1', backgroundColor: '#eef2ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #c7d2fe', flexShrink: 0 }}>
                          {size}
                        </span>
                      )}

                      {item.brand && (
                        <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0', flexShrink: 0 }}>
                          {item.brand}
                        </span>
                      )}
                    </div>

                    {/* Stock, Price & Add button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', backgroundColor: inStock ? '#ecfdf5' : '#fff1f2', color: inStock ? '#059669' : '#e11d48', border: `1px solid ${inStock ? '#a7f3d0' : '#fecdd3'}` }}>
                        {inStock ? `${qty} in stock` : 'Out of Stock'}
                      </span>

                      <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a', minWidth: '54px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px' }}>
                        <DirhamIcon size={10} color="#64748b" />
                        {price}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddItem(item);
                        }}
                        style={{
                          height: '26px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 800,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: isJustAdded ? '#10b981' : isSelected ? '#6366f1' : '#f1f5f9',
                          color: (isJustAdded || isSelected) ? '#ffffff' : '#334155',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isJustAdded ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={2.5} />}
                        <span>{isJustAdded ? 'Added' : 'Add'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // Standard View
              return (
                <div
                  key={item.id || item.item_code || idx}
                  className="drawer-item-row"
                  onClick={() => handleAddItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    border: `1.5px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                    backgroundColor: isSelected ? '#f5f3ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    gap: '14px',
                    boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.12)' : 'none'
                  }}
                >
                  {/* Left Column Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 800, color: '#475569', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        {item.id || item.item_code}
                      </span>

                      {barcode && (
                        <span style={{ fontFamily: 'monospace', fontSize: '9.5px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Barcode size={10} /> {barcode}
                        </span>
                      )}

                      {size && (
                        <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#6366f1', backgroundColor: '#eef2ff', padding: '1px 6px', borderRadius: '4px', border: '1px solid #c7d2fe' }}>
                          SZ: {size}
                        </span>
                      )}

                      {item.brand && (
                        <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#059669', backgroundColor: '#ecfdf5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                          {item.brand}
                        </span>
                      )}
                    </div>

                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: isSelected ? '#4338ca' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name || item.item_name}
                    </h4>

                    {(item.category || item.item_group) && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '10.5px', color: '#94a3b8', fontWeight: 600 }}>
                        {item.category || item.item_group}
                      </p>
                    )}
                  </div>

                  {/* Right Column Stock & Price */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', backgroundColor: inStock ? '#ecfdf5' : '#fff1f2', color: inStock ? '#059669' : '#e11d48', border: `1px solid ${inStock ? '#a7f3d0' : '#fecdd3'}` }}>
                        {inStock ? `${qty} in stock` : 'Out of Stock'}
                      </span>

                      <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <DirhamIcon size={10} color="#64748b" />
                        {price}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddItem(item);
                      }}
                      style={{
                        height: '30px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: isJustAdded ? '#10b981' : isSelected ? '#6366f1' : '#6366f1',
                        color: '#ffffff',
                        boxShadow: '0 2px 5px rgba(99, 102, 241, 0.25)',
                        transition: 'all 0.15s'
                      }}
                    >
                      {isJustAdded ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={2.5} />}
                      <span>{isJustAdded ? 'Added' : 'Add'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div 
          style={{
            padding: '10px 20px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            fontWeight: 600,
            color: '#64748b',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShoppingBag size={14} color="#6366f1" />
            <span>Click any item or press Enter to add directly to current invoice</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '8px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
