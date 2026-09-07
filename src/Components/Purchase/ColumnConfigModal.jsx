import React, { useState, useEffect } from 'react';
import { 
  X, GripVertical, Eye, EyeOff, RefreshCcw, Save, Trash2, ChevronUp, ChevronDown, AlignLeft, AlignCenter, AlignRight 
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem = ({ id, column, onToggle, onWidthChange, onAlignChange, onLabelChange, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState(column.label || '');

  useEffect(() => {
    setTempLabel(column.label || '');
  }, [column.label]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.6 : 1,
  };

  const handleLabelBlur = () => {
    setIsEditingLabel(false);
    if (tempLabel.trim() && tempLabel !== column.label) {
      onLabelChange(id, tempLabel.trim());
    } else {
      setTempLabel(column.label || '');
    }
  };

  const handleLabelKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setTempLabel(column.label || '');
      setIsEditingLabel(false);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3.5 bg-white border ${isDragging ? 'border-indigo-500 shadow-md ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'} rounded-xl shadow-xs group transition-all`}
    >
      {/* Drag Handle */}
      <div {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing p-1">
        <GripVertical size={16} />
      </div>

      {/* Up / Down buttons */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="w-5 h-4 sm:w-6 sm:h-5 flex items-center justify-center rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-20 transition-all"
        >
          <ChevronUp size={12} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="w-5 h-4 sm:w-6 sm:h-5 flex items-center justify-center rounded text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-20 transition-all"
        >
          <ChevronDown size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Visibility Toggle */}
      <button 
        type="button"
        onClick={() => onToggle(id)}
        className={`p-1.5 rounded-lg transition-colors shrink-0 ${column.visible ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'}`}
        title={column.visible ? "Hide Column" : "Show Column"}
      >
        {column.visible ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>

      {/* Editable Label Facility */}
      <div className="flex-1 min-w-0 pr-2">
        {isEditingLabel ? (
          <input
            type="text"
            autoFocus
            value={tempLabel}
            onChange={(e) => setTempLabel(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
            className="w-full text-xs sm:text-sm font-bold px-2 py-1 border border-indigo-500 rounded bg-indigo-50/50 outline-none text-slate-800"
          />
        ) : (
          <div className="flex items-center gap-1.5 group/label cursor-pointer" onClick={() => setIsEditingLabel(true)} title="Click to rename label">
            <p className={`text-xs sm:text-sm font-bold truncate ${column.visible ? 'text-slate-800' : 'text-slate-400'}`}>
              {column.label}
            </p>
            <span className="text-[10px] text-slate-400 opacity-0 group-hover/label:opacity-100 hover:text-indigo-600 transition-opacity">
              ✎
            </span>
          </div>
        )}
        <p className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider truncate">{id.replace(/_/g, ' ')}</p>
      </div>

      {/* Alignment Buttons */}
      <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg shrink-0">
        <button 
          type="button"
          onClick={() => onAlignChange(id, 'left')} 
          className={`p-1 rounded ${column.align === 'left' || !column.align ? 'bg-white shadow-xs text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
          title="Align Left"
        >
          <AlignLeft size={13} />
        </button>
        <button 
          type="button"
          onClick={() => onAlignChange(id, 'center')} 
          className={`p-1 rounded ${column.align === 'center' ? 'bg-white shadow-xs text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
          title="Align Center"
        >
          <AlignCenter size={13} />
        </button>
        <button 
          type="button"
          onClick={() => onAlignChange(id, 'right')} 
          className={`p-1 rounded ${column.align === 'right' ? 'bg-white shadow-xs text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
          title="Align Right"
        >
          <AlignRight size={13} />
        </button>
      </div>

      {/* Width Input */}
      <div className="flex items-center gap-1.5 shrink-0 pl-1">
        <label className="text-[9px] font-bold text-slate-400 hidden sm:inline">WIDTH</label>
        <input 
          type="number" 
          value={parseInt(column.width) || ''} 
          onChange={(e) => {
            const val = e.target.value;
            onWidthChange(id, val ? parseInt(val) + "px" : "100px");
          }}
          className="w-14 sm:w-16 h-7 sm:h-8 text-center text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white"
          min="20"
          max="800"
        />
        <span className="text-[9px] font-bold text-slate-400">PX</span>
      </div>
    </div>
  );
};

const ColumnConfigModal = ({ isOpen, onClose, config, columns, onUpdate, doctype, themeColor }) => {
  const [localConfig, setLocalConfig] = useState([]);

  useEffect(() => {
    if (isOpen) {
      const activeCols = Array.isArray(config) ? config : (Array.isArray(columns) ? columns : []);
      setLocalConfig([...activeCols]);
    }
  }, [isOpen, config, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setLocalConfig((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleVisibility = (id) => {
    setLocalConfig(prev => prev.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    ));
  };

  const updateWidth = (id, width) => {
    setLocalConfig(prev => prev.map(col => 
      col.id === id ? { ...col, width } : col
    ));
  };

  const updateAlign = (id, align) => {
    setLocalConfig(prev => prev.map(col => 
      col.id === id ? { ...col, align } : col
    ));
  };

  const updateLabel = (id, newLabel) => {
    setLocalConfig(prev => prev.map(col => 
      col.id === id ? { ...col, label: newLabel } : col
    ));
  };

  const resetToDefault = () => {
    // This will be handled by Parent passing its default
    if (window.confirm("Reset to default system column configuration?")) {
      onUpdate(null); // Parent should interpret null as Reset
      onClose();
    }
  };

  const moveColumn = (index, direction) => {
    const newConfig = [...localConfig];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newConfig.length) return;
    [newConfig[index], newConfig[targetIndex]] = [newConfig[targetIndex], newConfig[index]];
    setLocalConfig(newConfig);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)'
    }}>
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: '1.25rem',
        border: '1px solid #cbd5e1',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '0.75rem',
              backgroundColor: '#e0e7ff',
              color: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <RefreshCcw size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Configure Columns</h2>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.2rem 0 0' }}>
                {doctype || 'Document'} Matrix Table
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: '9999px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Subheader */}
        <div style={{
          padding: '0.6rem 1.75rem',
          backgroundColor: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          <span>Drag ≡ or use ↑↓ to reorder · Click eye to show/hide · Click label ✎ to rename</span>
          <span style={{ color: '#4f46e5' }}>{localConfig.filter(c => c.visible).length} / {localConfig.length} Visible</span>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem 1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}>
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={localConfig.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {localConfig.map((col, idx) => (
                  <SortableItem 
                    key={col.id} 
                    id={col.id} 
                    column={col} 
                    onToggle={toggleVisibility}
                    onWidthChange={updateWidth}
                    onAlignChange={updateAlign}
                    onLabelChange={updateLabel}
                    onMoveUp={() => moveColumn(idx, -1)}
                    onMoveDown={() => moveColumn(idx, 1)}
                    isFirst={idx === 0}
                    isLast={idx === localConfig.length - 1}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <button 
            type="button"
            onClick={resetToDefault}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#ef4444',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem'
            }}
          >
            <Trash2 size={16} />
            <span>Reset to Default</span>
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              type="button"
              onClick={onClose}
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#475569',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '0.6rem',
                cursor: 'pointer'
              }}
            >
              Discard
            </button>
            <button 
              type="button"
              onClick={() => { onUpdate(localConfig); onClose(); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.5rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                color: '#ffffff',
                backgroundColor: themeColor || '#4f46e5',
                border: 'none',
                borderRadius: '0.6rem',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
              }}
            >
              <Save size={16} />
              <span>Update Matrix</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default ColumnConfigModal;
