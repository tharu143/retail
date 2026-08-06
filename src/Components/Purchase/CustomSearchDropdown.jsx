import React, { useState, useEffect, useRef } from 'react';
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
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 288 });
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

          let topPos = rect.bottom + 8;
          let maxHeight = 288;

          if (spaceBelow < 280 && spaceAbove > spaceBelow) {
            // flip upwards
            maxHeight = Math.min(288, spaceAbove - 16);
            topPos = rect.top - maxHeight - 8;
          } else {
            maxHeight = Math.min(288, spaceBelow - 16);
          }

          const dropdownWidth = Math.max(rect.width, 350);
          let leftPos = rect.left;
          if (leftPos + dropdownWidth > window.innerWidth) {
            leftPos = window.innerWidth - dropdownWidth - 16;
          }
          if (leftPos < 16) {
            leftPos = 16;
          }

          setPosition({
            top: topPos,
            left: leftPos,
            width: rect.width,
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

  // Sync with external value
  useEffect(() => {
    if (value && value[optionsLabel]) {
      setQuery(value[optionsLabel]);
      setJustCreated(false);
    } else {
      setQuery('');
    }
  }, [value, optionsLabel]);

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
    if (!onGlobalSearch) return;
    setLoading(true);
    try {
      const data = await onGlobalSearch(query);
      setGlobalResults(data || []);
      setIsGlobalView(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (item) => {
    if (!onActivate) return;
    try {
      setActivating(item.name || item.item_code);
      const success = await onActivate(item);
      if (success) {
        // Refresh local search and select
        const localData = await fetchData(query);
        setResults(localData || []);
        setIsGlobalView(false);
        handleItemClick(item);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActivating(null);
    }
  };

  const handleCreate = async () => {
    if (!createOption || !query.trim()) return;

    try {
      setLoading(true);
      const newItem = await createOption(query.trim());

      if (newItem) {
        onSelect(newItem);
        setQuery(newItem.supplier_name || newItem.name || '');
        setShow(false);
        setJustCreated(true);

        // THEME-AWARE SUCCESS TOAST
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-fadeIn border-l-4 border-[var(--po-primary)]';
        toast.innerHTML = `
        <svg class="w-6 h-6 text-[var(--po-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
        </svg>
        <div>
          <div class="font-bold">Entry Created!</div>
          <div class="text-sm opacity-90">${newItem.supplier_name || newItem.name}</div>
        </div>
      `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }
    } catch (err) {
      console.warn("Handled error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item) => {
    onSelect(item);
    setQuery(item[optionsLabel]);
    setShow(false);
    setJustCreated(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!show || disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        handleItemClick(results[selectedIndex]);
      } else if (query.trim() && createOption && results.length === 0) {
        e.preventDefault();
        e.stopPropagation();
        handleCreate();
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
        <div className="relative flex-1" ref={inputRef}>
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
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:border-[var(--po-primary)] outline-none transition-all text-xs font-bold text-slate-700"
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
          className="custom-dropdown-portal fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] overflow-auto animate-fadeIn py-1"
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            minWidth: '350px',
            maxHeight: position.maxHeight || 288,
            zIndex: 20000, // CRITICAL: Focus above modal overlay (10500 z-index)
            '--po-primary': themeColor || '#6366f1',
            '--po-primary-light': themeColor && themeColor.startsWith('var(')
              ? `${themeColor.slice(0, -1)}-light)`
              : (themeColor ? `${themeColor}15` : '#6366f115')
          }}
        >
          {results.length > 0 && (
            <div className="py-1">
              {results.map((item, i) => (
                <div
                  key={i}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`custom-dropdown-item px-4 py-2.5 cursor-pointer flex justify-between items-center group transition-all ${selectedIndex === i ? 'bg-[var(--po-primary-light)]' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-[13px] transition-colors ${selectedIndex === i ? 'text-[var(--po-primary,#6366f1)]' : 'text-slate-700'}`}>
                        {item[optionsLabel] || item.name || item.item_code || 'Unknown'}
                      </span>
                      {item.actual_qty !== undefined && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase tracking-tight">
                          Stock: {item.actual_qty}
                        </span>
                      )}
                      {(item.last_purchase_rate || item.last_buying_rate || item.last_buying_price || item.rate) > 0 && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold px-1.5 py-0.5 rounded tracking-tight">
                          Last Pur: AED {parseFloat(item.last_purchase_rate || item.last_buying_rate || item.last_buying_price || item.rate).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {(item.name || item.item_code) && (item.name || item.item_code) !== item[optionsLabel] && (
                      <span className="text-[10px] text-slate-400 font-medium">{item.item_name || item.name || item.item_code}</span>
                    )}
                  </div>
                  {item.supplier_type && (
                    <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter opacity-70 group-hover:opacity-100 group-hover:bg-[var(--po-primary-light)] group-hover:text-[var(--po-primary)] transition-all">
                      {item.supplier_type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {isGlobalView && (
            <div className="py-1">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Results (Other Branches)</span>
                <button
                  onClick={() => setIsGlobalView(false)}
                  className="text-[10px] font-bold text-blue-600 hover:underline"
                >
                  Back to Local
                </button>
              </div>
              {globalResults.length > 0 ? (
                globalResults.map((item, i) => (
                  <div
                    key={i}
                    className="px-4 py-3 border-b border-slate-50 flex items-center justify-between hover:bg-slate-50 group"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-[13px] text-slate-700">{item[optionsLabel] || item.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Available in: {item.active_branches || 'Registry'}</span>
                    </div>
                    <button
                      onClick={() => handleActivate(item)}
                      disabled={activating === (item.name || item.item_code)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm"
                    >
                      {activating === (item.name || item.item_code) ? '...' : 'ACTIVATE'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No match in other branches</p>
                </div>
              )}
            </div>
          )}

          {results.length === 0 && !isGlobalView && query.length >= 1 && !loading && !justCreated && (
            <div className="p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                  <Search className="w-5 h-5 text-slate-300" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">No Local Matches</p>
                  <p className="text-[10px] text-slate-400 mb-4 font-medium italic">Check other branches for "{query}"?</p>

                  <div className="flex flex-col gap-2">
                    {globalSearch && (
                      <button
                        onClick={handleGlobalSearch}
                        className="text-[11px] bg-blue-600 text-white font-black py-2.5 px-6 rounded-lg hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <Search size={14} /> SEARCH OTHER BRANCHES
                      </button>
                    )}

                    {createOption && (
                      <button
                        onClick={handleCreate}
                        className="text-[11px] bg-[var(--po-primary)] text-white font-black py-2.5 px-6 rounded-lg hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <Plus size={14} /> REGISTER NEW RECORD
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSearchDropdown;