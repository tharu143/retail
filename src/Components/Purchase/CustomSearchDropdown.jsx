import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus } from 'lucide-react';

const CustomSearchDropdown = ({ 
  placeholder, 
  value, 
  onSelect, 
  fetchData, 
  createOption, 
  optionsLabel = "name", 
  extraCreateFields 
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const ref = useRef(null);

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
      if (ref.current && !ref.current.contains(e.target)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2 || justCreated) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchData(query);
        setResults(data || []);
      } catch (err) {
        console.error(err);
        setResults([]);
      }
      setLoading(false);
    }, 300);

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

      // GREEN SUCCESS TOAST
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-bounce';
      toast.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
        </svg>
        <div>
          <div class="font-bold">Supplier Created!</div>
          <div class="text-sm opacity-90">${newItem.supplier_name}</div>
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
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setJustCreated(false);
            }}
            onFocus={() => setShow(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all"
          />
          {loading && (
            <div className="absolute right-3 top-3 text-xs text-slate-500">Loading...</div>
          )}
        </div>

        {createOption && (
          <button
            onClick={handleCreate}
            disabled={loading || !query.trim()}
            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {show && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-auto">
          {/* Search Results */}
          {results.length > 0 ? (
            results.map((item, i) => (
              <div
                key={i}
                onClick={() => handleItemClick(item)}
                className="px-4 py-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between"
              >
                <span className="font-medium">{item[optionsLabel]}</span>
                {item.supplier_type && (
                  <span className="text-xs bg-slate-200 px-2 py-1 rounded">{item.supplier_type}</span>
                )}
              </div>
            ))
          ) : query.length >= 2 && !loading && !justCreated ? (
            <div className="p-4 text-center text-slate-500">
              {createOption ? (
                <div>
                  <p>No supplier found</p>
                  <button
                    onClick={handleCreate}
                    className="mt-2 text-sm text-green-600 font-medium hover:underline"
                  >
                    Click + to create "{query}"
                  </button>
                  {extraCreateFields && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border">
                      {extraCreateFields()}
                    </div>
                  )}
                </div>
              ) : (
                <p>No results</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default CustomSearchDropdown;