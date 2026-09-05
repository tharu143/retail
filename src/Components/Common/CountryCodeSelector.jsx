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
      const popHeight = 360;
      const popWidth = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      let top = rect.bottom + 8;
      if (spaceBelow < popHeight && rect.top > popHeight) {
        top = rect.top - popHeight - 8;
      }

      // Ensure a clean margin from screen edges
      const maxLeft = window.innerWidth - popWidth - 12;
      const left = Math.max(12, Math.min(rect.left, maxLeft));

      setDropdownPosition({
        top,
        left,
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
              width: '320px',
              maxHeight: '360px',
              boxShadow: '0 20px 35px -10px rgba(15, 23, 42, 0.25), 0 10px 20px -5px rgba(15, 23, 42, 0.1)',
            }}
          >
            {/* Clean ERPNext Style Search Header with clear margin & padding */}
            <div style={{ padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <Search size={15} style={{ position: 'absolute', left: '11px', color: '#94a3b8', pointerEvents: 'none', zIndex: 1 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search country or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 30px 0 34px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
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
                    style={{ position: 'absolute', right: '8px', color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* List Body with Generous Padding and Spacing */}
            <div style={{ padding: '10px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* GCC Primary Section */}
              {filteredGCC.length > 0 && (
                <div>
                  <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#065f46', background: '#ecfdf5', borderRadius: '8px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #a7f3d0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>🌟 GCC Countries</span>
                    <span style={{ fontSize: '8px', background: '#a7f3d0', color: '#064e3b', padding: '2px 6px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>Primary</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {filteredGCC.map((c, idx) => {
                      const isSelected = c.code === value;
                      const isKeyboardActive = activeIndex === idx;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleSelect(c.code)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                            cursor: 'pointer',
                            border: isSelected ? '1.5px solid #7dd3fc' : (isKeyboardActive ? '1.5px solid #38bdf8' : '1px solid transparent'),
                            backgroundColor: isSelected ? '#f0f9ff' : (isKeyboardActive ? '#e0f2fe' : 'transparent'),
                            color: isSelected || isKeyboardActive ? '#082f49' : '#334155',
                            boxSizing: 'border-box'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected && !isKeyboardActive) e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected && !isKeyboardActive) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: '17px', lineHeight: 1, flexShrink: 0, display: 'inline-flex' }}>{c.flag}</span>
                            <span style={{ fontWeight: 900, fontSize: '12px', color: '#0f172a', width: '46px', flexShrink: 0 }}>{c.code}</span>
                            <span style={{ color: '#475569', fontSize: '11.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.country}</span>
                          </div>
                          {isSelected && <Check size={15} style={{ color: '#0284c7', flexShrink: 0, fontWeight: 900, marginLeft: '8px' }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other All Countries Section */}
              {filteredOther.length > 0 && (
                <div>
                  <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', background: '#f1f5f9', borderRadius: '8px', marginBottom: '6px' }}>
                    All Countries
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {filteredOther.map((c, idx) => {
                      const isSelected = c.code === value;
                      const globalIdx = filteredGCC.length + idx;
                      const isKeyboardActive = activeIndex === globalIdx;
                      return (
                        <button
                          key={`${c.code}-${c.short}`}
                          type="button"
                          onClick={() => handleSelect(c.code)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                            cursor: 'pointer',
                            border: isSelected ? '1.5px solid #7dd3fc' : (isKeyboardActive ? '1.5px solid #38bdf8' : '1px solid transparent'),
                            backgroundColor: isSelected ? '#f0f9ff' : (isKeyboardActive ? '#e0f2fe' : 'transparent'),
                            color: isSelected || isKeyboardActive ? '#082f49' : '#334155',
                            boxSizing: 'border-box'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected && !isKeyboardActive) e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected && !isKeyboardActive) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: '17px', lineHeight: 1, flexShrink: 0, display: 'inline-flex' }}>{c.flag}</span>
                            <span style={{ fontWeight: 900, fontSize: '12px', color: '#0f172a', width: '46px', flexShrink: 0 }}>{c.code}</span>
                            <span style={{ color: '#475569', fontSize: '11.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.country}</span>
                          </div>
                          {isSelected && <Check size={15} style={{ color: '#0284c7', flexShrink: 0, fontWeight: 900, marginLeft: '8px' }} />}
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
