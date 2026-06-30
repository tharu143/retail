import React, { useState, useEffect } from 'react';
import { Settings, X, Search, CheckSquare, Square, RefreshCcw, Loader2, Trash2, Save } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function ListCustomizer({ doctype, onSave, themeColor = '#0ea5e9', saveKey, btnClassName, btnStyle }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);

  const actualSaveKey = saveKey || doctype;

  // Load custom columns from localStorage on mount/doctype change
  useEffect(() => {
    const saved = localStorage.getItem(`custom_columns_${actualSaveKey}`);
    if (saved) {
      try {
        setSelectedFields(JSON.parse(saved));
      } catch (e) {
        setSelectedFields([]);
      }
    } else {
      setSelectedFields([]);
    }
  }, [doctype, isOpen, actualSaveKey]);

  const loadFields = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/method/kyle_retail.retail_api.api.get_doctype_fields', {
        params: { doctype },
        withCredentials: true
      });
      if (res.data?.message?.status === 'success') {
        // Exclude system fields that are always displayed or internal
        const filtered = (res.data.message.fields || []).filter(f => 
          !['docstatus', 'parent', 'parentfield', 'parenttype', 'idx'].includes(f.fieldname)
        );
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

  const handleOpen = () => {
    setIsOpen(true);
    loadFields();
  };

  const handleToggleField = (fieldname) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldname)) {
        return prev.filter(f => f !== fieldname);
      } else {
        return [...prev, fieldname];
      }
    });
  };

  const handleSave = () => {
    localStorage.setItem(`custom_columns_${actualSaveKey}`, JSON.stringify(selectedFields));
    setIsOpen(false);
    if (onSave) onSave(selectedFields);
    Swal.fire({
      icon: 'success',
      title: 'Columns Updated',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000
    });
  };

  const handleReset = () => {
    localStorage.removeItem(`custom_columns_${actualSaveKey}`);
    setSelectedFields([]);
    setIsOpen(false);
    if (onSave) onSave([]);
    Swal.fire({
      icon: 'info',
      title: 'Columns Reset to Default',
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

  return (
    <>
      <button
        onClick={handleOpen}
        className={btnClassName}
        style={btnStyle || (btnClassName ? {} : {
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.9rem',
          background: '#f8fafc',
          border: `1.5px solid ${themeColor}`,
          borderRadius: '0.375rem',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: themeColor,
          cursor: 'pointer',
          transition: 'all 0.2s',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          height: '38px',
          boxSizing: 'border-box'
        })}
        title="Customize Columns"
      >
        <Settings size={14} />
        Columns
      </button>

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
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div 
            style={{
              backgroundColor: '#f8fafc',
              width: '100%',
              maxWidth: '560px',
              borderRadius: '24px',
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
                padding: '20px 32px',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div 
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${themeColor}15`,
                    color: themeColor
                  }}
                >
                  <Settings size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.025em' }}>Configure Columns</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select fields for {doctype}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  width: '40px',
                  height: '40px',
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
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div 
              style={{
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflowY: 'auto',
                minHeight: '350px',
                boxSizing: 'border-box'
              }}
            >
              {/* Search */}
              <div style={{ position: 'relative', flexShrink: 0, marginBottom: '24px' }}>
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
                  placeholder="Search schema fields..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    paddingLeft: '44px',
                    paddingRight: '16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 'bold',
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
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '380px', paddingRight: '4px' }}>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#94a3b8', gap: '8px', height: '100%' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: themeColor }} />
                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Loading schema...</span>
                  </div>
                ) : filteredFields.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: '#94a3b8', height: '100%' }}>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>No matching fields</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                            padding: '12px 16px',
                            backgroundColor: '#ffffff',
                            border: `1px solid ${isSelected ? themeColor : '#e2e8f0'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: isSelected ? `0 4px 12px ${themeColor}15` : 'none'
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) e.currentTarget.style.borderColor = `${themeColor}60`;
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) e.currentTarget.style.borderColor = '#e2e8f0';
                          }}
                        >
                          {/* Toggle Check */}
                          <div 
                            style={{
                              padding: '6px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              backgroundColor: isSelected ? themeColor : '#f1f5f9',
                              color: isSelected ? '#ffffff' : '#94a3b8'
                            }}
                          >
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>

                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: isSelected ? '#0f172a' : '#475569' }}>
                              {field.label}
                            </p>
                            <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.025em' }}>{field.fieldname} · {field.fieldtype}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div 
              style={{
                padding: '24px 32px',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box'
              }}
            >
              <button
                onClick={handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
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
                <Trash2 size={16} />
                <span>Reset to Default</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#475569',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 32px',
                    fontSize: '14px',
                    fontWeight: 900,
                    color: '#ffffff',
                    backgroundColor: themeColor,
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: `0 10px 15px -3px ${themeColor}33`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}
                >
                  <Save size={18} />
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
