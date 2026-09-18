import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, Search, CheckSquare, Square, Loader2, Trash2, Save, ArrowUp, ArrowDown, SlidersHorizontal, Check, Eye, EyeOff, LayoutGrid, GripVertical } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { fetchUserListConfig, saveUserListConfig } from '../../utils/tableMatrixHelper';

export default function ListCustomizer({
  doctype,
  defaultColumns = [],
  onSave,
  themeColor = '#0082f6',
  saveKey,
  btnClassName,
  btnStyle,
  iconOnly = false,
  title = "Configure & Reorder Columns"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [hiddenDefaults, setHiddenDefaults] = useState([]);
  const [orderedColumns, setOrderedColumns] = useState(() => defaultColumns.map(c => c.key || c.id));
  const [draggedIndex, setDraggedIndex] = useState(null);

  const actualSaveKey = saveKey || doctype;

  // Build initial default list of visible columns in order
  const getDefaultOrdered = (hidden = [], custom = []) => {
    const defaultVisibleKeys = defaultColumns
      .map(c => c.key || c.id)
      .filter(k => !hidden.includes(k));
    return [...defaultVisibleKeys, ...custom];
  };

  // Load configuration directly via API for this user
  useEffect(() => {
    let isMounted = true;
    fetchUserListConfig(actualSaveKey, defaultColumns).then(cfg => {
      if (!isMounted || !cfg) return;
      setHiddenDefaults(cfg.hiddenDefaults || []);
      setSelectedFields(cfg.customColumns || []);
      setOrderedColumns(cfg.orderedColumns || getDefaultOrdered(cfg.hiddenDefaults, cfg.customColumns));
    });
    return () => { isMounted = false; };
  }, [doctype, isOpen, actualSaveKey]);

  const defaultKeysSet = new Set(
    defaultColumns.map(c => (c.key || c.id || '').toLowerCase().trim())
  );

  const loadFields = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_doctype_fields', {
        params: { doctype },
        withCredentials: true
      });
      if (res.data?.message?.status === 'success') {
        const rawFields = res.data.message.fields || [];
        // Filter out system fields AND fields that are already in defaultColumns to avoid duplication
        const filtered = rawFields.filter(f => {
          if (!f.fieldname) return false;
          if (['docstatus', 'parent', 'parentfield', 'parenttype', 'idx'].includes(f.fieldname)) return false;
          const fnLower = f.fieldname.toLowerCase().trim();
          if (defaultKeysSet.has(fnLower)) return false;
          return true;
        });
        setFields(filtered);
      } else {
        Swal.fire('Error', res.data?.message?.message || 'Failed to fetch fields.', 'error');
      }
    } catch (err) {
      console.error('Failed to load fields:', err);
      Swal.fire('Error', 'Unable to connect to metadata service.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (e) => {
    if (e) e.stopPropagation();
    setIsOpen(true);
    loadFields();
  };

  const handleToggleDefault = (colKey) => {
    setHiddenDefaults(prev => {
      const isCurrentlyHidden = prev.includes(colKey);
      const nextHidden = isCurrentlyHidden ? prev.filter(k => k !== colKey) : [...prev, colKey];
      
      // Update orderedColumns accordingly
      setOrderedColumns(prevOrdered => {
        if (isCurrentlyHidden) {
          // Becoming visible -> add to end if not present
          return prevOrdered.includes(colKey) ? prevOrdered : [...prevOrdered, colKey];
        } else {
          // Becoming hidden -> remove
          return prevOrdered.filter(k => k !== colKey);
        }
      });
      
      return nextHidden;
    });
  };

  const handleToggleField = (fieldname) => {
    setSelectedFields(prev => {
      const isCurrentlySelected = prev.includes(fieldname);
      const nextSelected = isCurrentlySelected ? prev.filter(f => f !== fieldname) : [...prev, fieldname];
      
      // Update orderedColumns accordingly
      setOrderedColumns(prevOrdered => {
        if (!isCurrentlySelected) {
          // Becoming visible -> add to end
          return prevOrdered.includes(fieldname) ? prevOrdered : [...prevOrdered, fieldname];
        } else {
          // Becoming hidden -> remove
          return prevOrdered.filter(k => k !== fieldname);
        }
      });

      return nextSelected;
    });
  };

  const moveColumn = (index, direction) => {
    setOrderedColumns(prev => {
      const copy = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    setOrderedColumns(prev => {
      const copy = [...prev];
      const [draggedItem] = copy.splice(draggedIndex, 1);
      copy.splice(dropIndex, 0, draggedItem);
      return copy;
    });
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    const config = {
      orderedColumns,
      hiddenDefaults,
      customColumns: selectedFields
    };
    
    // Save directly to user database table settings via API
    await saveUserListConfig(actualSaveKey, config, defaultColumns);

    setIsOpen(false);
    if (onSave) {
      onSave(selectedFields, hiddenDefaults, orderedColumns, config);
    }

    Swal.fire({
      icon: 'success',
      title: 'Columns Configured',
      text: 'Customized column order & visibility saved successfully.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000
    });
  };

  const handleReset = async () => {
    const defaultOrdered = defaultColumns.map(c => c.key || c.id);
    setHiddenDefaults([]);
    setSelectedFields([]);
    setOrderedColumns(defaultOrdered);
    setIsOpen(false);
    
    // Reset directly via API
    await saveUserListConfig(actualSaveKey, null, defaultColumns);

    if (onSave) {
      onSave([], [], defaultOrdered, { hiddenDefaults: [], customColumns: [], orderedColumns: defaultOrdered });
    }

    Swal.fire({
      icon: 'info',
      title: 'Reset to Default Columns',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000
    });
  };

  const filteredFields = fields.filter(f => 
    (f.label || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.fieldname || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getColLabel = (colKey) => {
    const defCol = defaultColumns.find(c => (c.key || c.id) === colKey);
    if (defCol) return defCol.label;
    const foundField = fields.find(f => f.fieldname === colKey);
    if (foundField) return foundField.label;
    return colKey.replace(/_/g, ' ').toUpperCase();
  };

  const isColDefault = (colKey) => {
    return defaultColumns.some(c => (c.key || c.id) === colKey);
  };

  const handleRemoveColumn = (colKey) => {
    if (isColDefault(colKey)) {
      setHiddenDefaults(prev => (prev.includes(colKey) ? prev : [...prev, colKey]));
    } else {
      setSelectedFields(prev => prev.filter(f => f !== colKey));
    }
    setOrderedColumns(prev => prev.filter(k => k !== colKey));
  };

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          onClick={handleOpen}
          className={btnClassName}
          style={btnStyle || {
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = themeColor;
            e.currentTarget.style.background = `${themeColor}15`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#64748b';
            e.currentTarget.style.background = 'transparent';
          }}
          title={title}
        >
          <SlidersHorizontal size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className={btnClassName}
          style={btnStyle || {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            height: '38px',
            padding: '0 16px',
            background: '#ffffff',
            border: `1.5px solid ${themeColor}`,
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 800,
            color: themeColor,
            cursor: 'pointer',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            boxSizing: 'border-box'
          }}
          title={title}
        >
          <Settings size={14} />
          Columns
        </button>
      )}

      {isOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div 
            style={{
              backgroundColor: '#f8fafc',
              width: '100%',
              maxWidth: '720px',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              textAlign: 'left'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              style={{
                padding: '18px 24px',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div 
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${themeColor}15`,
                    color: themeColor
                  }}
                >
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Configure & Reorder Columns</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Default & Custom fields for {doctype}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div 
              style={{
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflowY: 'auto',
                minHeight: '350px',
                boxSizing: 'border-box',
                gap: '18px'
              }}
            >
              {/* Active Visible Table Columns (Order: 1st, 2nd, 3rd...) with Drag and Drop */}
              <div style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a' }}>
                        Active Table Columns (Order: Left to Right)
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: themeColor, backgroundColor: `${themeColor}15`, padding: '2px 8px', borderRadius: '6px' }}>
                        {orderedColumns.length} Visible
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                      Drag and drop using <GripVertical size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> or click arrows (↑ ↓) to set which column appears 1st, 2nd, 3rd, etc.
                    </p>
                  </div>
                </div>

                {orderedColumns.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 600, border: '1px dashed #cbd5e1', borderRadius: '10px' }}>
                    No visible columns selected. Check standard or custom fields below to add columns.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                    {orderedColumns.map((colKey, idx) => {
                      const isDefault = isColDefault(colKey);
                      const isDragging = draggedIndex === idx;

                      return (
                        <div
                          key={colKey}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={(e) => handleDrop(e, idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 12px',
                            backgroundColor: isDragging ? `${themeColor}15` : isDefault ? '#f8fafc' : `${themeColor}08`,
                            border: `1.5px solid ${isDragging ? themeColor : isDefault ? '#e2e8f0' : `${themeColor}40`}`,
                            borderRadius: '10px',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            opacity: isDragging ? 0.6 : 1,
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <div style={{ color: '#94a3b8', cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                              <GripVertical size={16} />
                            </div>
                            <span 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                width: '22px', 
                                height: '22px', 
                                borderRadius: '6px', 
                                backgroundColor: isDefault ? '#334155' : themeColor, 
                                color: '#ffffff', 
                                fontSize: '11px', 
                                fontWeight: 800 
                              }}
                            >
                              {idx + 1}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {getColLabel(colKey)}
                            </span>
                            <span 
                              style={{ 
                                fontSize: '9px', 
                                fontWeight: 800, 
                                textTransform: 'uppercase', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                backgroundColor: isDefault ? '#e2e8f0' : `${themeColor}20`,
                                color: isDefault ? '#64748b' : themeColor
                              }}
                            >
                              {isDefault ? 'Standard' : 'Custom'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveColumn(idx, -1)}
                              style={{
                                background: idx === 0 ? 'transparent' : '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 6px',
                                cursor: idx === 0 ? 'default' : 'pointer',
                                opacity: idx === 0 ? 0.3 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                color: '#334155'
                              }}
                              title="Move Up / Earlier in table"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === orderedColumns.length - 1}
                              onClick={() => moveColumn(idx, 1)}
                              style={{
                                background: idx === orderedColumns.length - 1 ? 'transparent' : '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '4px 6px',
                                cursor: idx === orderedColumns.length - 1 ? 'default' : 'pointer',
                                opacity: idx === orderedColumns.length - 1 ? 0.3 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                color: '#334155'
                              }}
                              title="Move Down / Later in table"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveColumn(colKey)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: '4px',
                                borderRadius: '4px'
                              }}
                              title="Hide / Remove from table"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Standard / Default Columns Section */}
              {defaultColumns && defaultColumns.length > 0 && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a' }}>
                        Standard List Columns
                      </span>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                        Check or uncheck to show/hide standard table columns in the view.
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: themeColor, backgroundColor: `${themeColor}12`, padding: '2px 8px', borderRadius: '6px' }}>
                      {defaultColumns.length - hiddenDefaults.length} / {defaultColumns.length} Visible
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                    {defaultColumns.map(col => {
                      const colKey = col.key || col.id;
                      const isVisible = !hiddenDefaults.includes(colKey);
                      return (
                        <div
                          key={colKey}
                          onClick={() => handleToggleDefault(colKey)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px 12px',
                            backgroundColor: isVisible ? `${themeColor}08` : '#f8fafc',
                            border: `1.5px solid ${isVisible ? themeColor : '#e2e8f0'}`,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div 
                            style={{
                              color: isVisible ? themeColor : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {isVisible ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: isVisible ? 800 : 600, color: isVisible ? '#0f172a' : '#64748b' }}>
                            {col.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add Custom Fields from Schema Section (Deduplicated) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#334155' }}>
                      Add Additional Schema Fields
                    </span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                      Select additional fields from Frappe DocType schema to add as visible columns.
                    </p>
                  </div>
                  {selectedFields.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFields([]);
                        setOrderedColumns(prev => prev.filter(k => isColDefault(k)));
                      }}
                      style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Clear All Custom
                    </button>
                  )}
                </div>

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Search 
                    size={16} 
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search additional fields by name or label..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      paddingLeft: '42px',
                      paddingRight: '16px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#334155',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={e => e.target.style.borderColor = themeColor}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                  />
                </div>

                {/* Fields List */}
                <div style={{ overflowY: 'auto', maxHeight: '200px', paddingRight: '4px' }}>
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px', color: '#94a3b8', gap: '8px' }}>
                      <Loader2 size={26} className="animate-spin" style={{ color: themeColor }} />
                      <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Loading schema fields...</span>
                    </div>
                  ) : filteredFields.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', color: '#94a3b8' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>No matching fields found</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {filteredFields.map((field) => {
                        const isSelected = selectedFields.includes(field.fieldname);
                        return (
                          <div 
                            key={field.fieldname}
                            onClick={() => handleToggleField(field.fieldname)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 14px',
                              backgroundColor: '#ffffff',
                              border: `1.5px solid ${isSelected ? themeColor : '#e2e8f0'}`,
                              borderRadius: '10px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              boxShadow: isSelected ? `0 2px 8px ${themeColor}15` : 'none'
                            }}
                            onMouseEnter={e => {
                              if (!isSelected) e.currentTarget.style.borderColor = `${themeColor}60`;
                            }}
                            onMouseLeave={e => {
                              if (!isSelected) e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                          >
                            <div 
                              style={{
                                padding: '4px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                backgroundColor: isSelected ? themeColor : '#f1f5f9',
                                color: isSelected ? '#ffffff' : '#94a3b8'
                              }}
                            >
                              {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                            </div>

                            <div style={{ flex: 1 }}>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: isSelected ? '#0f172a' : '#475569' }}>
                                {field.label}
                              </p>
                              <p style={{ margin: '1px 0 0 0', fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                {field.fieldname} · {field.fieldtype}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div 
              style={{
                padding: '16px 24px',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box'
              }}
            >
              <button
                type="button"
                onClick={handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#ef4444',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.color = '#ef4444'}
              >
                <Trash2 size={15} />
                <span>Reset to Default</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: '#475569',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 24px',
                    fontSize: '13px',
                    fontWeight: 900,
                    color: '#ffffff',
                    backgroundColor: themeColor,
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: `0 8px 12px -3px ${themeColor}33`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}
                >
                  <Save size={16} />
                  <span>Save Columns</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
