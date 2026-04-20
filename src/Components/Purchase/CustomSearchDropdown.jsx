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
  themeColor = "#10b981" // Default to green
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Sync with external value
  useEffect(() => {
    if (show && inputRef.current) {
      const updatePosition = () => {
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setPosition({
            top: rect.bottom,
            left: rect.left,
            width: rect.width
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
        const data = await fetchData(query || '');
        setResults(data || []);
      } catch (err) {
        console.error(err);
        setResults([]);
      }
      setLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, fetchData, justCreated]);

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
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && results[selectedIndex]) {
        e.preventDefault();
        handleItemClick(results[selectedIndex]);
      } else if (query.trim() && createOption && results.length === 0) {
        e.preventDefault();
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      setShow(false);
    }
  };

  return (
    <div 
      className="relative w-full" 
      ref={ref}
      style={{ 
        '--po-primary': themeColor,
        '--po-primary-light': `${themeColor}15`
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
            }}
            onFocus={() => !disabled && setShow(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:border-[var(--po-primary)] outline-none transition-all text-xs font-bold text-slate-700"
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
          className="custom-dropdown-portal fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] max-h-72 overflow-auto animate-fadeIn py-1"
          style={{
            top: position.top + 8,
            left: position.left,
            width: position.width,
            '--po-primary': themeColor || '#6366f1',
            '--po-primary-light': themeColor ? `${themeColor}15` : '#6366f115'
          }}
        >
          {results.length > 0 && (
            <div className="py-1">
              {results.map((item, i) => (
                <div
                  key={i}
                  onClick={() => handleItemClick(item)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`px-4 py-2.5 cursor-pointer flex justify-between items-center group transition-all ${selectedIndex === i ? 'bg-[var(--po-primary-light)]' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex flex-col">
                    <span className={`font-bold text-[13px] transition-colors ${selectedIndex === i ? 'text-[var(--po-primary,#6366f1)]' : 'text-slate-700'}`}>
                      {item[optionsLabel] || item.name || item.item_code || 'Unknown'}
                    </span>
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
              
              {createOption && (
                 <div 
                   onClick={handleCreate}
                   className="mt-1 px-4 py-3 border-t border-slate-100 cursor-pointer bg-slate-50 hover:bg-[var(--po-primary-light)] group transition-colors"
                 >
                   <div className="flex items-center gap-2 text-[var(--po-primary)] font-black text-xs">
                     <Plus size={14} />
                     CREATE NEW: "{query}"
                   </div>
                 </div>
              )}
            </div>
          )}

          {results.length === 0 && query.length >= 1 && !loading && !justCreated && (
            <div className="p-6 text-center">
              {createOption ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                    <Search className="w-5 h-5 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">No Matches Found</p>
                    <p className="text-[10px] text-slate-400 mb-3 font-medium">Register "{query}" as a new record?</p>
                    <button
                      onClick={handleCreate}
                      className="text-[11px] bg-[var(--po-primary)] text-white font-black py-2 px-6 rounded-lg hover:opacity-90 transition-all shadow-lg flex items-center gap-2 mx-auto"
                    >
                      <Plus size={14} /> CREATE NEW
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No entries found</p>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSearchDropdown;