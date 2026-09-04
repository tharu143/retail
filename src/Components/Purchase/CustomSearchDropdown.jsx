import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus } from 'lucide-react';

const CustomSearchDropdown = ({
  placeholder,
  value,
  onSelect,
  fetchData,
  createOption,
  optionsLabel = "name",
  extraCreateFields,
  disabled = false,
  themeColor = "#10b981", // Default to green
  globalSearch = false,
  onGlobalSearch, // (query) => Promise<results>
  onActivate // (item) => Promise<success>
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [globalResults, setGlobalResults] = useState([]);
  const [isGlobalView, setIsGlobalView] = useState(false);
  const [activating, setActivating] = useState(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 360 });
  const ref = useRef(null);
  const inputRef = useRef(null);
  const fetchDataRef = useRef(fetchData);
  const dropdownContainerRef = useRef(null);

  // Keep ref in sync
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Scroll active item into view
  useEffect(() => {
    if (show && selectedIndex >= 0 && dropdownContainerRef.current) {
      const container = dropdownContainerRef.current;
      const activeEl = container.querySelectorAll('.custom-dropdown-item')[selectedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [selectedIndex, show]);

  // Sync with external value
  useEffect(() => {
    if (show && inputRef.current) {
      const updatePosition = () => {
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceAbove = rect.top;

          const estimatedHeight = results.length > 0 ? Math.min(results.length * 52 + 20, 320) : (isGlobalView ? 220 : 130);
          let topPos = rect.bottom + 4;
          let maxHeight = 320;

          // Only flip upward if space below is less than 120px AND space above is significantly larger
          if (spaceBelow < 140 && spaceAbove > 200) {
            maxHeight = Math.min(320, spaceAbove - 16);
            topPos = Math.max(8, rect.top - Math.min(estimatedHeight, maxHeight) - 4);
          } else {
            maxHeight = Math.min(320, Math.max(120, spaceBelow - 16));
          }

          let leftPos = rect.left;
          const targetWidth = rect.width < 180 ? 280 : rect.width;
          if (leftPos + targetWidth > window.innerWidth - 12) {
            leftPos = Math.max(12, window.innerWidth - targetWidth - 12);
          }

          setPosition({
            top: topPos,
            left: leftPos,
            width: targetWidth,
            maxHeight
          });
        }
      };

      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [show]);

  // Sync with external value only when value actually changes from outside
  useEffect(() => {
    if (value && value[optionsLabel]) {
      setQuery(value[optionsLabel]);
    } else if (!value) {
      setQuery('');
    }
  }, [value?.[optionsLabel]]);

  // Click outside → close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        !e.target.closest('.custom-dropdown-portal')
      ) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (justCreated) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchDataRef.current(query || '');
        setResults(data || []);
      } catch (err) {
        console.error(err);
        setResults([]);
      }
      setLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, justCreated, isGlobalView]);

  const handleGlobalSearch = async () => {
    console.log('[CustomSearchDropdown] SEARCH OTHER BRANCHES clicked! Query:', query, 'onGlobalSearch prop present?', !!onGlobalSearch);
    if (!onGlobalSearch) {
      console.warn('[CustomSearchDropdown] onGlobalSearch prop is missing!');
      return;
    }
    setLoading(true);
    try {
      const data = await onGlobalSearch(query);
      console.log('[CustomSearchDropdown] handleGlobalSearch received data:', data);
      setGlobalResults(data || []);
      setIsGlobalView(true);
      console.log('[CustomSearchDropdown] Switched isGlobalView to TRUE, count:', (data || []).length);
    } catch (err) {
      console.error('[CustomSearchDropdown] handleGlobalSearch caught error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (item) => {
    console.log('[CustomSearchDropdown] ACTIVATE clicked for item:', item, 'onActivate prop present?', !!onActivate);
    if (!onActivate) return;
    try {
      setActivating(item.name || item.item_code);
      const success = await onActivate(item);
      console.log('[CustomSearchDropdown] onActivate returned:', success);
      if (success) {
        // Refresh local search and select
        const localData = await fetchData(query);
        setResults(localData || []);
        setIsGlobalView(false);
        handleItemClick(item);
      }
    } catch (err) {
      console.error('[CustomSearchDropdown] handleActivate caught error:', err);
    } finally {
      setActivating(null);
    }
  };

  const handleCreate = async () => {
    console.log('[CustomSearchDropdown] handleCreate clicked! Query:', query, 'createOption prop:', !!createOption);
    if (!createOption || !query.trim()) return;

    setShow(false); // Close the dropdown so the modal can be cleanly interacted with
    try {
      const res = createOption(query.trim());
      if (res && typeof res.then === 'function') {
        const newItem = await res;
        if (newItem) {
          onSelect(newItem);
          setQuery(newItem.supplier_name || newItem.name || '');
          setJustCreated(true);
        }
      }
    } catch (err) {
      console.warn("[CustomSearchDropdown] handleCreate error:", err);
    }
  };

  const displayResults = useMemo(() => {
    if (!Array.isArray(results)) return [];
    const seen = new Set();
    return results.filter(item => {
      const labelVal = item[optionsLabel] || item.item_name || item.name || item.item_code || '';
      const key = String(labelVal).trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [results, optionsLabel]);

  const handleItemClick = (item) => {
    onSelect(item);
    const label = item[optionsLabel] || item.item_name || item.name || item.item_code || '';
    setQuery(label);
    setShow(false);
    setJustCreated(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!show || disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => (prev < displayResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (displayResults.length > 0) {
        const idxToSelect = selectedIndex >= 0 ? selectedIndex : 0;
        handleItemClick(displayResults[idxToSelect]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setShow(false);
    }
  };

  return (
    <div
      className="relative w-full"
      ref={ref}
      style={{
        '--po-primary': themeColor,
        '--po-primary-light': themeColor && themeColor.startsWith('var(')
          ? `${themeColor.slice(0, -1)}-light)`
          : (themeColor ? `${themeColor}15` : '#6366f115')
      }}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            ref={inputRef}
            value={query}
            onChange={(e) => {
              if (disabled) return;
              setQuery(e.target.value);
              setJustCreated(false);
              setSelectedIndex(-1);
              setIsGlobalView(false);
            }}
            onFocus={() => !disabled && setShow(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 bg-slate-50/30 border border-slate-200 rounded-lg text-slate-800 text-sm font-semibold outline-none focus:border-[var(--po-primary)] focus:bg-white transition-all shadow-sm"
            style={{ height: '42px' }}
            disabled={disabled}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {createOption && results.length === 0 && query.trim().length >= 2 && !loading && (
          <button
            onClick={handleCreate}
            disabled={loading || !query.trim()}
            className="px-4 bg-[var(--po-primary)] text-white rounded-lg hover:opacity-90 disabled:bg-gray-200 disabled:text-gray-400 transition-colors font-bold text-xs"
          >
            Create
          </button>
        )}
      </div>

      {show && createPortal(
        <div
          ref={dropdownContainerRef}
          className="custom-dropdown-portal fixed z-[9999] bg-white border border-slate-200 rounded-2xl shadow-[0_12px_48px_-12px_rgba(0,0,0,0.15)] overflow-auto animate-fadeIn py-2"
          style={{
            top: position.top,
            left: position.left,
            width: Math.max(position.width, 320),
            minWidth: Math.max(position.width, 320),
            maxHeight: position.maxHeight || 360,
            zIndex: 20000, // CRITICAL: Focus above modal overlay (10500 z-index)
            '--po-primary': themeColor || '#6366f1',
            '--po-primary-light': themeColor && themeColor.startsWith('var(')
              ? `${themeColor.slice(0, -1)}-light)`
              : (themeColor ? `${themeColor}15` : '#6366f115')
          }}
        >
          {displayResults.length > 0 && (
            <div className="py-1 flex flex-col">
              {displayResults.map((item, i) => (
                <div
                  key={i}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`custom-dropdown-item mx-2 my-0.5 px-4 py-3 cursor-pointer flex justify-between items-center group transition-all rounded-xl ${selectedIndex === i ? 'bg-[var(--po-primary-light)]' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex flex-col gap-1 flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-[13.5px] transition-colors truncate ${selectedIndex === i ? 'text-[var(--po-primary,#6366f1)]' : 'text-slate-700'}`}>
                        {item[optionsLabel] || item.item_name || item.name || item.item_code || 'Unknown'}
                      </span>
                      {item.actual_qty !== undefined && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0">
                          Stock: {item.actual_qty}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.supplier_type && (
                    <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter opacity-70 group-hover:opacity-100 group-hover:bg-[var(--po-primary-light)] group-hover:text-[var(--po-primary)] transition-all shrink-0">
                      {item.supplier_type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {isGlobalView && (
            <div className="py-1">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Results (Other Branches)</span>
                <button
                  onClick={() => setIsGlobalView(false)}
                  className="text-[10px] font-bold text-blue-600 hover:underline"
                >
                  Back to Local
                </button>
              </div>
              {globalResults.length > 0 ? (
                <div className="flex flex-col">
                  {globalResults.map((item, i) => (
                    <div
                      key={i}
                      className="mx-2 my-0.5 px-4 py-3 rounded-xl flex items-center justify-between hover:bg-slate-50 group transition-all"
                    >
                      <div className="flex flex-col gap-1 flex-1 min-w-0 pr-3">
                        <span className="font-bold text-[13.5px] text-slate-700 truncate">{item[optionsLabel] || item.name}</span>
                        <span className="text-[10px] text-slate-400 font-semibold tracking-wide font-mono truncate">Available in: {item.active_branches || 'Registry'}</span>
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleActivate(item);
                        }}
                        disabled={activating === (item.name || item.item_code)}
                        className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm shrink-0 cursor-pointer"
                      >
                        {activating === (item.name || item.item_code) ? '...' : 'ACTIVATE'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">No match in other branches</p>
                  <p className="text-[10px] text-slate-400 mb-3 font-medium italic">Item does not exist anywhere in catalog</p>
                  {createOption && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCreate();
                      }}
                      className="w-full text-[11px] bg-emerald-600 text-white font-black py-2 px-3 rounded-lg hover:bg-emerald-700 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={13} /> + CREATE NEW ITEM
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Persistent Action Footer (Available whether matches exist or not) */}
          {!isGlobalView && query.trim().length >= 1 && (
            <div className="px-2 py-2 mt-1 border-t border-slate-100 bg-slate-50/70 flex flex-col gap-1.5 rounded-b-xl">
              {globalSearch && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleGlobalSearch();
                  }}
                  className="w-full text-[11px] bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black py-2 px-3 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Search size={12} /> SEARCH OTHER BRANCHES
                </button>
              )}

              {createOption && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreate();
                  }}
                  className="w-full text-[11px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black py-2 px-3 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} /> + {optionsLabel === 'supplier_name' || placeholder?.toLowerCase()?.includes('supplier') ? 'CREATE SUPPLIER' : 'CREATE NEW ITEM'}
                </button>
              )}
            </div>
          )}

          {results.length === 0 && !isGlobalView && query.length >= 1 && !loading && !justCreated && (
            <div className="p-3 text-center">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">No Local Matches</p>
              <p className="text-[10px] text-slate-400 mb-1 font-medium italic">No direct result found for "{query}"</p>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSearchDropdown;