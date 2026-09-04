import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { GCC_COUNTRIES, OTHER_COUNTRIES, getCountryRule } from '../../utils/countryCodes';

const CountryCodeSelector = ({
  value,
  onChange,
  className = '',
  style = {},
  variant = 'default', // 'default' | 'classic' | 'modal'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedCountry = useMemo(() => {
    return getCountryRule(value);
  }, [value]);

  // Calculate clean placement
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const popHeight = 330;
      
      let top = rect.bottom + 6;
      if (spaceBelow < popHeight && rect.top > popHeight) {
        top = rect.top - popHeight - 6;
      }

      setDropdownPosition({
        top,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 310)),
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  // Focus search input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filteredGCC = useMemo(() => {
    if (!searchTerm.trim()) return GCC_COUNTRIES;
    const q = searchTerm.toLowerCase().trim();
    return GCC_COUNTRIES.filter(
      (c) =>
        c.country.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        (c.short && c.short.toLowerCase().includes(q))
    );
  }, [searchTerm]);

  const filteredOther = useMemo(() => {
    if (!searchTerm.trim()) return OTHER_COUNTRIES;
    const q = searchTerm.toLowerCase().trim();
    return OTHER_COUNTRIES.filter(
      (c) =>
        c.country.toLowerCase().includes(q) ||
        c.code.includes(q) ||
        (c.short && c.short.toLowerCase().includes(q))
    );
  }, [searchTerm]);

  const allFilteredItems = useMemo(() => {
    return [...filteredGCC, ...filteredOther];
  }, [filteredGCC, filteredOther]);

  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchTerm]);

  const handleSelect = (code) => {
    onChange(code);
    setIsOpen(false);
    setSearchTerm('');
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < allFilteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : allFilteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < allFilteredItems.length) {
        handleSelect(allFilteredItems[activeIndex].code);
      } else if (allFilteredItems.length > 0) {
        handleSelect(allFilteredItems[0].code);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`flex items-center justify-between gap-1.5 px-2.5 outline-none transition-all cursor-pointer select-none font-bold text-xs shrink-0 ${
          variant === 'classic'
            ? 'h-full bg-slate-100 hover:bg-slate-200 text-slate-800 border-r-2 border-slate-200'
            : variant === 'modal'
            ? 'h-10 bg-slate-50/80 hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg shadow-2xs'
            : 'h-full bg-slate-50/90 hover:bg-slate-100 text-slate-700 border-r border-slate-200'
        } ${className}`}
        style={{
          minWidth: '98px',
          width: '98px',
          height: variant === 'modal' ? '40px' : '100%',
          ...style,
        }}
        title={`Country Code: ${selectedCountry.country} (${selectedCountry.code}) - Press F4 to toggle`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base leading-none drop-shadow-xs">{selectedCountry.flag || '🌐'}</span>
          <span className="font-mono font-black text-[12.5px] text-slate-800 tracking-tight">
            {selectedCountry.code}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-600' : ''
          }`}
        />
      </button>

      {/* Spacious, Premium & Beautiful Dropdown Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-white border border-slate-200/90 rounded-2xl shadow-2xl z-[999999] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: '300px',
              maxHeight: '340px',
              boxShadow: '0 20px 30px -10px rgba(15, 23, 42, 0.25), 0 10px 15px -5px rgba(15, 23, 42, 0.1)',
            }}
          >
            {/* Clean ERPNext Style Search Header */}
            <div style={{ padding: '8px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: '#94a3b8', pointerEvents: 'none', zIndex: 1 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search country or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 28px 0 32px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#0284c7'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{ position: 'absolute', right: '8px', color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* List Body with Generous Padding and Spacing */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-2 text-xs">
              {/* GCC Primary Section */}
              {filteredGCC.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50/90 rounded-lg mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">🌟 GCC Countries</span>
                    <span className="text-[8px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded font-extrabold uppercase">Primary</span>
                  </div>
                  <div className="space-y-0.5">
                    {filteredGCC.map((c, idx) => {
                      const isSelected = c.code === value;
                      const isKeyboardActive = activeIndex === idx;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleSelect(c.code)}
                          className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                            isKeyboardActive
                              ? 'bg-sky-100 text-sky-950 font-bold shadow-xs'
                              : isSelected
                              ? 'bg-sky-50/90 text-sky-950 font-bold border border-sky-200/60'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base leading-none drop-shadow-xs">{c.flag}</span>
                            <span className="font-extrabold text-xs text-slate-900 w-11 shrink-0">{c.code}</span>
                            <span className="text-slate-600 truncate text-[11.5px] font-medium">{c.country}</span>
                          </div>
                          {isSelected && <Check size={14} className="text-sky-600 flex-shrink-0 font-bold ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other All Countries Section */}
              {filteredOther.length > 0 && (
                <div>
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100/80 rounded-lg mb-1">
                    All Countries
                  </div>
                  <div className="space-y-0.5">
                    {filteredOther.map((c, idx) => {
                      const isSelected = c.code === value;
                      const globalIdx = filteredGCC.length + idx;
                      const isKeyboardActive = activeIndex === globalIdx;
                      return (
                        <button
                          key={`${c.code}-${c.short}`}
                          type="button"
                          onClick={() => handleSelect(c.code)}
                          className={`w-full px-2.5 py-2 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                            isKeyboardActive
                              ? 'bg-sky-100 text-sky-950 font-bold shadow-xs'
                              : isSelected
                              ? 'bg-sky-50/90 text-sky-950 font-bold border border-sky-200/60'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base leading-none drop-shadow-xs">{c.flag}</span>
                            <span className="font-extrabold text-xs text-slate-900 w-11 shrink-0">{c.code}</span>
                            <span className="text-slate-600 truncate text-[11.5px] font-medium">{c.country}</span>
                          </div>
                          {isSelected && <Check size={14} className="text-sky-600 flex-shrink-0 font-bold ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filteredGCC.length === 0 && filteredOther.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  No matching countries found
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default CountryCodeSelector;
