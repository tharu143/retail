import React from 'react';
import { X, Printer, Layout, Check, Square, CheckSquare } from 'lucide-react';

function PrintConfigModal({
  isOpen,
  onClose,
  columns = [],
  selectedColumns = [],
  onSelectedColumnsChange,
  orientation = 'portrait',
  onOrientationChange,
  onPrint,
  themeColor = '#4f46e5'
}) {
  if (!isOpen) return null;

  const handleToggleColumn = (fieldname) => {
    if (selectedColumns.includes(fieldname)) {
      onSelectedColumnsChange(selectedColumns.filter(c => c !== fieldname));
    } else {
      onSelectedColumnsChange([...selectedColumns, fieldname]);
    }
  };

  const handleSelectAll = () => {
    onSelectedColumnsChange(columns.map(c => c.fieldname));
  };

  const handleSelectNone = () => {
    onSelectedColumnsChange([]);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        backgroundColor: '#ffffff',
        borderRadius: '1.25rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '85vh',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: `linear-gradient(135deg, ${themeColor}0a, #ffffff)`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={20} style={{ color: themeColor }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Print Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.35rem',
              borderRadius: '0.375rem',
              color: '#64748b',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Orientation Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.75rem' }}>
              Page Orientation
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Portrait Option */}
              <div
                onClick={() => onOrientationChange('portrait')}
                style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: `2px solid ${orientation === 'portrait' ? themeColor : '#e2e8f0'}`,
                  backgroundColor: orientation === 'portrait' ? `${themeColor}05` : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '42px',
                  border: `2px solid ${orientation === 'portrait' ? themeColor : '#64748b'}`,
                  borderRadius: '3px',
                  backgroundColor: orientation === 'portrait' ? `${themeColor}15` : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ width: '16px', height: '2px', backgroundColor: orientation === 'portrait' ? themeColor : '#64748b', opacity: 0.5 }}></div>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: orientation === 'portrait' ? '#0f172a' : '#64748b' }}>
                  Portrait
                </span>
              </div>

              {/* Landscape Option */}
              <div
                onClick={() => onOrientationChange('landscape')}
                style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: `2px solid ${orientation === 'landscape' ? themeColor : '#e2e8f0'}`,
                  backgroundColor: orientation === 'landscape' ? `${themeColor}05` : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{
                  width: '42px',
                  height: '32px',
                  border: `2px solid ${orientation === 'landscape' ? themeColor : '#64748b'}`,
                  borderRadius: '3px',
                  backgroundColor: orientation === 'landscape' ? `${themeColor}15` : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ width: '20px', height: '2px', backgroundColor: orientation === 'landscape' ? themeColor : '#64748b', opacity: 0.5 }}></div>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: orientation === 'landscape' ? '#0f172a' : '#64748b' }}>
                  Landscape
                </span>
              </div>
            </div>
          </div>

          {/* Columns Selection */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: 0 }}>
                Select Columns to Print
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleSelectAll}
                  style={{ background: 'none', border: 'none', color: themeColor, fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                >
                  Select All
                </button>
                <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>|</span>
                <button
                  onClick={handleSelectNone}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              padding: '0.75rem',
              backgroundColor: '#f8fafc',
              borderRadius: '0.75rem',
              border: '1px solid #f1f5f9',
              maxHeight: '240px',
              overflowY: 'auto'
            }}>
              {columns.map((col) => {
                const isChecked = selectedColumns.includes(col.fieldname);
                return (
                  <div
                    key={col.fieldname}
                    onClick={() => handleToggleColumn(col.fieldname)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: isChecked ? '#ffffff' : 'transparent',
                      boxShadow: isChecked ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    {isChecked ? (
                      <CheckSquare size={16} style={{ color: themeColor }} />
                    ) : (
                      <Square size={16} style={{ color: '#cbd5e1' }} />
                    )}
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: isChecked ? 700 : 500,
                      color: isChecked ? '#0f172a' : '#64748b',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {col.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            Cancel
          </button>
          <button
            onClick={onPrint}
            disabled={selectedColumns.length === 0}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              border: `1.5px solid ${themeColor}`,
              backgroundColor: themeColor,
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: selectedColumns.length === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedColumns.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <Printer size={15} /> Confirm & Print
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}} />
    </div>
  );
}

export default PrintConfigModal;
